import { WebSocket, WebSocketServer } from 'ws';
import { FinishGameDTO } from './dto/response/FinishGameDTO';
import { ChangePlayerTurnDTO } from './dto/response/ChangePlayerTurnDTO';
import { gameFieldRepository } from './repository/GameFieldRepository';
import { CreateGameDTO } from './dto/response/CreateGameDTO';
import { AddPlayerDTO } from './dto/request/AddPlayerDTO';
import { AllCommunicationDTOTypes, CommunicationDTO, CommunicationDTOTypes } from './dto/CommunicationDTO';
import { PlayerRequestDTO } from './dto/request/PlayerRequestDTO';
import { PlayerResponseDTO } from './dto/response/PlayerResponseDTO';
import { IPlayer } from './interfaces/IPlayer';
import { playerRepository } from './repository/PlayerRepository';
import { IRoom } from './interfaces/IRoom';
import { roomRepository } from './repository/RoomRepository';
import { RoomDTO, RoomUser } from './dto/response/RoomDTO';
import { Router } from './Router';
import { IGame } from './interfaces/IGame';
import { gameRepository } from './repository/GameRepository';
import { AddShipsDTO } from './dto/request/AddShipsDTO';
import { IGameField, IGameFieldEnemyAttack } from './interfaces/IGameField';
import { StartGameDTO } from './dto/response/StartGameDTO';
import { AttackRequestDTO } from './dto/request/AttackRequestDTO';
import { AttackResponseDTO, TAttackStatus } from './dto/response/AttackResponseDTO';
import { RandomAttackRequestDTO } from './dto/request/RandomAttackRequestDTO';
import { getRandomInt } from './utils/utils';
import { WinnerDTO } from './dto/response/WinnerDTO';

export class ConnectionHandler {
  private ws: WebSocket;

  private wsServer: WebSocketServer;

  private router: Router = new Router();

  private playerId = -1;

  constructor(webSocket: WebSocket, webSocketServer: WebSocketServer) {
    this.ws = webSocket;
    this.wsServer = webSocketServer;

    const updateRooms = () => {
      const rooms = roomRepository.findAll();
      const roomPlayers = (room: IRoom) => {
        const players: Array<RoomUser> = [];
        room.playersId.forEach((id, i) => {
          const player = playerRepository.findOne(id);
          if (player) {
            players.push({ name: player.name, index: i } as RoomUser);
          }
        });
        return players;
      };
      console.log(rooms);

      const roomsDTO = rooms.map((room) => ({ roomId: room.id, roomUsers: roomPlayers(room) }) as RoomDTO);
      try {
        const roomsDTOSting = JSON.stringify(roomsDTO);
        this.sendToAll('update_room', roomsDTOSting);
      } catch (err) {
        console.error(err);
      }
    };

    const sendRegSuccess = (player: IPlayer) => {
      const respData: PlayerResponseDTO = {
        name: player.name,
        index: player.id,
        error: false,
      };

      try {
        const playerResponseDTOSting = JSON.stringify(respData);
        this.sendToPlayer('reg', playerResponseDTOSting);
      } catch (err) {
        console.error(err);
      }

      this.playerId = player.id;
    };

    const sendLoginNotSuccess = (player: IPlayer, reason: string) => {
      const respData: PlayerResponseDTO = {
        name: player.name,
        index: player.id,
        error: true,
        errorText: reason,
      };

      try {
        const playerResponseDTOSting = JSON.stringify(respData);
        this.sendToPlayer('reg', playerResponseDTOSting);
      } catch (err) {
        console.error(err);
      }
    };

    const processReg = (ws: WebSocket, messageData: string) => {
      const playerReq = JSON.parse(messageData) as PlayerRequestDTO;

      if (!playerReq || playerReq.name === undefined || playerReq.password === undefined) {
        return;
      }

      if (playerReq.name.length < 5 || playerReq.password.length < 5) {
        return;
      }

      const existingPlayer = playerRepository.findPlayerByName(playerReq.name);

      const isPlayerExist = existingPlayer !== null;

      if (isPlayerExist) {
        if (existingPlayer.password !== playerReq.password) {
          sendLoginNotSuccess(existingPlayer, 'Login failed: password incorrect');
          return;
        }

        if (existingPlayer.isOnline) {
          sendLoginNotSuccess(existingPlayer, 'Login failed: only one session is allowed');
          return;
        }

        this.playerId = existingPlayer.id;
        existingPlayer.isOnline = true;
        playerRepository.update(existingPlayer.id, existingPlayer);
        sendRegSuccess(existingPlayer);
        return;
      }

      const newPlayer: IPlayer = {
        id: 1,
        name: playerReq.name,
        password: playerReq.password,
        score: 0,
        isOnline: true,
      };

      const result = playerRepository.create(newPlayer);

      console.log(playerRepository.findAll());

      if (result) {
        sendRegSuccess(result);
      }
    };

    const processCreateRoom = (ws: WebSocket, messageData: string) => {
      if (this.playerId < 0) {
        return;
      }

      const newRoom: IRoom = { id: 0, playersId: [this.playerId], isInGame: false };
      const result = roomRepository.create(newRoom);

      if (result) {
        updateRooms();
      }
    };

    const processAddUserToRoom = (ws: WebSocket, messageData: string) => {
      if (this.getPlayerId() < 0) {
        return;
      }

      const addPlayerDTO = JSON.parse(messageData) as AddPlayerDTO;
      if (!addPlayerDTO || addPlayerDTO.indexRoom === undefined) {
        return;
      }

      const foundRoom = roomRepository.findOne(addPlayerDTO.indexRoom);

      if (!foundRoom) {
        return;
      }

      if (!foundRoom.playersId || foundRoom.playersId.length >= 2) {
        return;
      }

      if (foundRoom.playersId[0] === this.getPlayerId()) {
        return;
      }

      const enemyId = foundRoom.playersId[0];

      roomRepository.delete(foundRoom.id);

      const game: IGame = {
        id: 0,
        playersId: [enemyId, this.getPlayerId()],
        currentTurnPlayerId: enemyId,
        isFinished: false,
      };

      const createGameResult = gameRepository.create(game);

      if (!createGameResult) {
        return;
      }

      const playerCreateGameDTO: CreateGameDTO = {
        idGame: createGameResult.id,
        idPlayer: this.getPlayerId(),
      };

      const enemyCreateGameDTO: CreateGameDTO = {
        idGame: createGameResult.id,
        idPlayer: enemyId,
      };

      try {
        const playerCreateGameDTOString = JSON.stringify(playerCreateGameDTO);
        const enemyCreateGameDTOString = JSON.stringify(enemyCreateGameDTO);

        this.sendToPlayer('create_game', playerCreateGameDTOString);
        this.onSendMessageToPlayerWithId(enemyId, 'create_game', enemyCreateGameDTOString);
      } catch (e) {
        console.log(e);
      }

      updateRooms();
    };

    const sendStartGameWithIdForPlayerId = (gameId: number, playerId: number) => {
      const game = gameRepository.findOne(gameId);

      if (!game) {
        return;
      }

      const gameField = gameFieldRepository.findGameFieldByGameIdAndPlayerId(gameId, playerId);

      if (!gameField) {
        return;
      }

      const { ships } = gameField;
      const startGameDTO: StartGameDTO = {
        ships,
        currentPlayerIndex: playerId,
      };

      try {
        const startGameDTOSting = JSON.stringify(startGameDTO);
        this.onSendMessageToPlayerWithId(playerId, 'start_game', startGameDTOSting);
      } catch (err) {
        console.error(err);
      }
    };

    const changePlayerTurn = (gameId: number, playerIdTurn: number) => {
      const game = gameRepository.findOne(gameId);

      if (!game) {
        return;
      }

      const { playersId } = game;

      if (!playersId || playersId.length !== 2) {
        return;
      }

      const isPlayerIdInGame = playersId.find((id) => id === playerIdTurn) !== undefined;

      if (!isPlayerIdInGame) {
        return;
      }

      game.playersId = [...playersId];
      game.currentTurnPlayerId = playerIdTurn;

      gameRepository.update(gameId, game);
    };

    const sendPlayerTurnByPlayerId = (playerIdTurn: number, playerId: number) => {
      const changePlayerTurnDTO: ChangePlayerTurnDTO = {
        currentPlayer: playerIdTurn,
      };

      try {
        const changePlayerTurnDTOSting = JSON.stringify(changePlayerTurnDTO);
        this.onSendMessageToPlayerWithId(playerId, 'turn', changePlayerTurnDTOSting);
      } catch (err) {
        console.error(err);
      }
    };

    const processAddShips = (ws: WebSocket, messageData: string) => {
      if (this.getPlayerId() < 0) {
        return;
      }

      const addShipsDTO = JSON.parse(messageData) as AddShipsDTO;
      if (!addShipsDTO || addShipsDTO.gameId === undefined || addShipsDTO.indexPlayer === undefined) {
        return;
      }

      if (addShipsDTO.ships === undefined || addShipsDTO.ships.length < 0 || addShipsDTO.ships.length !== 10) {
        return;
      }

      const gameField: IGameField = {
        id: 0,
        gameId: addShipsDTO.gameId,
        playerId: this.getPlayerId(),
        ships: [...addShipsDTO.ships],
        enemyAttacks: new Array<IGameFieldEnemyAttack>(),
      };

      const gameFieldResult = gameFieldRepository.create(gameField);

      if (!gameFieldResult) {
        return;
      }

      const game = gameRepository.findOne(addShipsDTO.gameId);

      if (!game) {
        return;
      }

      const enemyId = game.playersId.filter((playerId) => playerId !== this.getPlayerId());

      if (!enemyId || enemyId.length === 0) {
        return;
      }

      const enemyGameField = gameFieldRepository.findGameFieldByGameIdAndPlayerId(game.id, enemyId[0]);

      if (!enemyGameField) {
        return;
      }

      game.playersId.forEach((playerId) => {
        sendStartGameWithIdForPlayerId(game.id, playerId);
      });

      game.playersId.forEach((playerId) => {
        sendPlayerTurnByPlayerId(game.currentTurnPlayerId, playerId);
      });
    };

    const sendAttackResponseForPlayerWithId = (playerId: number, attackResponseDTO: AttackResponseDTO) => {
      try {
        const changePlayerTurnDTOSting = JSON.stringify(attackResponseDTO);
        this.onSendMessageToPlayerWithId(playerId, 'attack', changePlayerTurnDTOSting);
      } catch (err) {
        console.error(err);
      }
    };

    const getAttackDTO = (xAttack: number, yAttack: number, playerId: number, status: TAttackStatus) => {
      const attackDTO: AttackResponseDTO = {
        position: { x: xAttack, y: yAttack },
        currentPlayer: playerId,
        status,
      };

      return attackDTO;
    };

    interface TGameFieldCell {
      shipIndex: number;
      isHit: boolean;
      isMiss: boolean;
    }

    const getConvertedGameField = (attackedPlayerGameField: IGameField) => {
      const { ships, enemyAttacks } = attackedPlayerGameField;

      const copy = new Array<TGameFieldCell | null>(10);
      const nodes = new Array<typeof copy>(10);

      for (let i = 0; i < 10; i++) {
        copy[i] = null;
      }

      for (let i = 0; i < nodes.length; i++) {
        nodes[i] = copy.slice(0);
      }

      const gameField = nodes;

      ships.forEach((ship, index) => {
        for (let i = 0; i < ship.length; i += 1) {
          if (ship.direction) {
            gameField[ship.position.x][ship.position.y + i] = {
              shipIndex: index,
              isHit: false,
              isMiss: false,
            };
          } else {
            gameField[ship.position.x + i][ship.position.y] = {
              shipIndex: index,
              isHit: false,
              isMiss: false,
            };
          }
        }
      });

      enemyAttacks.forEach((attack) => {
        if (gameField[attack.position.x][attack.position.y]) {
          const cell = gameField[attack.position.x][attack.position.y];
          if (cell) {
            cell.isHit = true;
          } else {
            gameField[attack.position.x][attack.position.y] = {
              shipIndex: -1,
              isHit: false,
              isMiss: true,
            };
          }
        }
      });

      return gameField;
    };

    const markAllNeighborCellsAsMiss = (attackedPlayerGameField: IGameField, xAttack: number, yAttack: number) => {
      const gameField = getConvertedGameField(attackedPlayerGameField);

      const cell = gameField[xAttack][yAttack];

      if (!cell) {
        return;
      }

      const { shipIndex } = cell;

      const ship = attackedPlayerGameField.ships[shipIndex];

      const isVertical = ship.direction;

      let maxHorizontal = isVertical ? ship.position.x + 2 : ship.position.x + ship.length + 1;
      maxHorizontal = maxHorizontal > 10 ? 10 : maxHorizontal;

      let maxVertical = isVertical ? ship.position.y + ship.length + 1 : ship.position.y + 2;
      maxVertical = maxVertical > 10 ? 10 : maxVertical;

      console.log('maxVertical :>> ', maxVertical);
      console.log('maxHorizontal :>> ', maxHorizontal);
      console.log('x, y :>> ', xAttack, yAttack);
      console.log('length :>> ', ship.length);

      const minHorizontal = ship.position.x > 0 ? ship.position.x - 1 : 0;
      const minVertical = ship.position.y > 0 ? ship.position.y - 1 : 0;

      const newAttacks = new Array<IGameFieldEnemyAttack>();

      for (let xSearch = minHorizontal; xSearch < maxHorizontal; xSearch += 1) {
        for (let ySearch = minVertical; ySearch < maxVertical; ySearch += 1) {
          if (gameField[xSearch] && gameField[xSearch][ySearch] !== undefined) {
            const cellFound = gameField[xSearch][ySearch];
            if (cellFound === null) {
              newAttacks.push({ position: { x: xSearch, y: ySearch } });
            }
          }
        }
      }

      const newGameField = { ...attackedPlayerGameField };

      newGameField.enemyAttacks = [...newGameField.enemyAttacks, ...newAttacks];

      gameFieldRepository.update(newGameField.id, newGameField);

      const game = gameRepository.findOne(newGameField.gameId);

      if (!game) {
        return;
      }

      const { playersId } = game;

      const attackedPlayerId = attackedPlayerGameField.playerId;
      const attackerPlayerId = playersId.filter((id) => id !== attackedPlayerId)[0];

      newAttacks.forEach((attack) => {
        const attackedDTO = getAttackDTO(attack.position.x, attack.position.y, attackerPlayerId, 'miss');
        sendAttackResponseForPlayerWithId(attackedPlayerId, attackedDTO);

        const attackerDTO = getAttackDTO(attack.position.x, attack.position.y, attackerPlayerId, 'miss');
        sendAttackResponseForPlayerWithId(attackerPlayerId, attackerDTO);
      });
    };

    const calculateAttack = (attackedPlayerGameField: IGameField, xAttack: number, yAttack: number): TAttackStatus => {
      const { ships } = attackedPlayerGameField;
      const gameField = getConvertedGameField(attackedPlayerGameField);

      const cell = gameField[xAttack][yAttack];
      if (cell) {
        const ship = ships[cell.shipIndex];
        if (ship) {
          if (ship.length === 1) {
            return 'killed';
          }

          let foundCellsHitWithShipId = 0;

          for (let x = 0; x < gameField.length; x++) {
            for (let y = 0; y < gameField[x].length; y++) {
              const cellToFind = gameField[x][y];
              if (cellToFind) {
                if (cellToFind.shipIndex === cell.shipIndex && cellToFind.isHit) {
                  foundCellsHitWithShipId += 1;
                }
              }
            }
          }

          console.log('foundCellsHitWithShipId :>> ', foundCellsHitWithShipId);

          if (foundCellsHitWithShipId + 1 >= ship.length) {
            return 'killed';
          }

          return 'shot';
        }
      }

      return 'miss';
    };

    const processAttack = (ws: WebSocket, messageData: string) => {
      if (this.playerId === -1) {
        return;
      }

      const attackReq = JSON.parse(messageData) as AttackRequestDTO;
      const { gameId, x, y, indexPlayer } = attackReq;

      if (gameId === undefined || x === undefined || y === undefined || indexPlayer === undefined) {
        return;
      }

      const game = gameRepository.findOne(gameId);

      if (!game) {
        return;
      }

      if (game.currentTurnPlayerId !== this.playerId) {
        return;
      }

      const { playersId } = game;
      if (!playersId || playersId.length !== 2) {
        return;
      }

      const enemyId = playersId.filter((playerId) => playerId !== attackReq.indexPlayer)[0];

      const enemyGameField = gameFieldRepository.findGameFieldByGameIdAndPlayerId(gameId, enemyId);

      if (!enemyGameField) {
        return;
      }

      // const getIsAttackExists = (xFind: number, yFind: number, enemyAttacks: Array<IGameFieldEnemyAttack>) => {
      //   const isHasBeenAttacked = enemyAttacks.find(
      //     (attack) => attack.position.x === xFind && attack.position.y === yFind,
      //   );
      //   return isHasBeenAttacked !== undefined;
      // };

      // const IsAttackExists = getIsAttackExists(x, y, enemyGameField.enemyAttacks);

      // if (IsAttackExists) {
      //   return;
      // }

      const result = calculateAttack(enemyGameField, x, y);

      enemyGameField.enemyAttacks = [...enemyGameField.enemyAttacks, { position: { x, y } }];

      const newGameField = gameFieldRepository.update(enemyGameField.id, enemyGameField);

      if (!newGameField) {
        return;
      }

      playersId.forEach((playerId) => {
        const res = sendAttackResponseForPlayerWithId(playerId, getAttackDTO(x, y, attackReq.indexPlayer, result));
        return res;
      });

      if (result === 'killed') {
        markAllNeighborCellsAsMiss(newGameField, x, y);
      }

      playersId.forEach((playerId) => {
        const res = sendPlayerTurnByPlayerId(enemyId, playerId);
        return res;
      });

      changePlayerTurn(game.id, enemyId);
    };

    const generateRandomAttackByPlayerIdAndGameId = (playerId: number, gameId: number) => {
      const gameField = gameFieldRepository.findGameFieldByGameIdAndPlayerId(gameId, playerId);

      if (!gameField) {
        return null;
      }

      let found = false;
      let counter = 0;

      let x = 0;
      let y = 0;

      const getIsAttackExists = (xFind: number, yFind: number, enemyAttacks: Array<IGameFieldEnemyAttack>) => {
        const isHasBeenAttacked = enemyAttacks.find(
          (attack) => attack.position.x === xFind && attack.position.y === yFind,
        );
        return isHasBeenAttacked !== undefined;
      };

      while (!found) {
        x = getRandomInt(0, 9);
        y = getRandomInt(0, 9);

        found = !getIsAttackExists(x, y, gameField.enemyAttacks);
        counter += 1;

        if (counter > 99) {
          break;
        }
      }

      return { x, y };
    };

    const processRandomAttack = (ws: WebSocket, messageData: string) => {
      const randomAttackRequestDTO = JSON.parse(messageData) as RandomAttackRequestDTO;

      if (!randomAttackRequestDTO) {
        return;
      }

      if (randomAttackRequestDTO.gameId === undefined || randomAttackRequestDTO.indexPlayer === undefined) {
        return;
      }

      const game = gameRepository.findOne(randomAttackRequestDTO.gameId);

      if (!game) {
        return;
      }

      const { playersId } = game;
      if (!playersId || playersId.length !== 2) {
        return;
      }

      const generatedAttack = generateRandomAttackByPlayerIdAndGameId(
        randomAttackRequestDTO.indexPlayer,
        randomAttackRequestDTO.gameId,
      );

      if (!generatedAttack) {
        return;
      }

      const { x, y } = generatedAttack;

      const enemyId = playersId.filter((playerId) => playerId !== randomAttackRequestDTO.indexPlayer)[0];

      const enemyGameField = gameFieldRepository.findGameFieldByGameIdAndPlayerId(game.id, enemyId);

      if (!enemyGameField) {
        return;
      }

      const result = calculateAttack(enemyGameField, x, y);

      enemyGameField.enemyAttacks = [...enemyGameField.enemyAttacks, { position: { x, y } }];

      const newGameField = gameFieldRepository.update(enemyGameField.id, enemyGameField);

      if (!newGameField) {
        return;
      }

      playersId.forEach((playerId) => {
        const res = sendAttackResponseForPlayerWithId(
          playerId,
          getAttackDTO(x, y, randomAttackRequestDTO.indexPlayer, result),
        );
        return res;
      });

      playersId.forEach((playerId) => {
        const res = sendPlayerTurnByPlayerId(enemyId, playerId);
        return res;
      });

      changePlayerTurn(game.id, enemyId);
    };

    const { router } = this;

    router.addRoute('reg', (ws: WebSocket, messageData: string) => processReg(ws, messageData));
    router.addRoute('create_room', (ws: WebSocket, messageData: string) => processCreateRoom(ws, messageData));
    router.addRoute('add_user_to_room', (ws: WebSocket, messageData: string) => processAddUserToRoom(ws, messageData));
    router.addRoute('add_ships', (ws: WebSocket, messageData: string) => processAddShips(ws, messageData));
    router.addRoute('attack', (ws: WebSocket, messageData: string) => processAttack(ws, messageData));
    router.addRoute('randomAttack', (ws: WebSocket, messageData: string) => processRandomAttack(ws, messageData));
  }

  onSendMessageToPlayerWithId = (playerId: number, messageType: CommunicationDTOTypes, message: string) => null;

  getPlayerId() {
    return this.playerId;
  }

  handleMessage(data: Buffer) {
    try {
      const message = JSON.parse(data?.toString()) as CommunicationDTO;

      if (!message) {
        return;
      }

      if (!message.type || !AllCommunicationDTOTypes.includes(message.type)) {
        return;
      }

      if (message.data === null || message.data === undefined) {
        return;
      }

      console.log('received: %s', message);

      this.router.handle(message.type, this.ws, message.data);
    } catch (e) {
      console.log(e);
    }
  }

  sendToAll(messageType: CommunicationDTOTypes, message: string) {
    console.log('sendToAll:');
    this.wsServer.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        const resp: CommunicationDTO = {
          type: messageType,
          data: message,
          id: 0,
        };
        try {
          const respMessage = JSON.stringify(resp);
          client.send(respMessage);
          console.log(respMessage);
        } catch (e) {
          console.log(e);
        }
      }
    });
  }

  sendToPlayer(messageType: CommunicationDTOTypes, message: string) {
    console.log(`sendToPlayer with id ${this.getPlayerId()}:`);
    const resp: CommunicationDTO = {
      type: messageType,
      data: message,
      id: 0,
    };
    try {
      const respMessage = JSON.stringify(resp);
      this.ws.send(respMessage);
      console.log(respMessage);
    } catch (e) {
      console.log(e);
    }
  }

  onClose() {
    console.log('onClose');

    const playerId = this.getPlayerId();
    console.log('playerId', playerId);
    if (playerId === -1) {
      return;
    }

    const existingPlayer = playerRepository.findOne(playerId);

    if (existingPlayer) {
      existingPlayer.isOnline = false;
      playerRepository.update(existingPlayer.id, existingPlayer);
    }

    const game = gameRepository.findGameByPlayerId(playerId);

    if (!game) {
      return;
    }

    if (!game.playersId || game.playersId.length !== 2) {
      return;
    }

    game.isFinished = true;

    const result = gameRepository.update(game.id, game);

    if (!result) {
      return;
    }

    const enemyId = game.playersId.filter((id) => id !== playerId)[0];

    const playerEnemy = playerRepository.findOne(enemyId);

    if (!playerEnemy) {
      return;
    }

    playerEnemy.score += 1;

    const res = playerRepository.update(playerEnemy.id, playerEnemy);

    if (!res) {
      return;
    }

    this.sendPlayerWin(game.id, enemyId);
  }

  sendPlayerWin(gameId: number, winnerPlayerId: number) {
    const res: FinishGameDTO = {
      winPlayer: winnerPlayerId,
    };

    try {
      const stringFinishGameDTO = JSON.stringify(res);

      const game = gameRepository.findOne(gameId);
      if (!game) {
        return;
      }

      const players = game.playersId;

      players.forEach((playerId) => this.onSendMessageToPlayerWithId(playerId, 'finish', stringFinishGameDTO));
    } catch (err) {
      console.error(err);
    }

    this.updateWinners();
  }

  updateWinners() {
    const players = playerRepository.findAll();
    if (!players || players.length === 0) {
      return;
    }

    const winners = players.filter((player) => player.score > 0);

    if (!winners || winners.length === 0) {
      return;
    }

    const winnersDTO: Array<WinnerDTO> = winners
      .map((winner) => ({ name: winner.name, wins: winner.score }))
      .sort((a, b) => a.wins - b.wins);

    try {
      const winnersDTOString = JSON.stringify(winnersDTO);
      this.sendToAll('update_winners', winnersDTOString);
    } catch (err) {
      console.error(err);
    }
  }
}
