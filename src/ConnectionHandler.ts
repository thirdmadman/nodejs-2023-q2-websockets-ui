import { WebSocket, WebSocketServer } from 'ws';
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

    const processReg = (ws: WebSocket, messageData: string) => {
      const playerReq = JSON.parse(messageData) as PlayerRequestDTO;

      const newPlayer: IPlayer = { id: 1, name: playerReq.name, password: playerReq.password, score: 0 };
      const result = playerRepository.create(newPlayer);

      console.log(playerRepository.findAll());

      if (result) {
        const respData: PlayerResponseDTO = {
          name: result.name,
          index: result.id,
          error: false,
        };

        try {
          const playerResponseDTOSting = JSON.stringify(respData);
          this.sendToPlayer('reg', playerResponseDTOSting);
        } catch (err) {
          console.error(err);
        }

        this.playerId = newPlayer.id;
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
        ships: { ...addShipsDTO.ships },
        enemyAttacks: Array<IGameFieldEnemyAttack>(),
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

      console.log('game.currentTurnPlayerId :>> ', game.currentTurnPlayerId);
      console.log('this.playerId :>> ', this.playerId);

      if (game.currentTurnPlayerId !== this.playerId) {
        return;
      }

      const { playersId } = game;
      if (!playersId || playersId.length !== 2) {
        return;
      }

      const result = 'miss';

      playersId.forEach((playerId) => {
        const res = sendAttackResponseForPlayerWithId(playerId, getAttackDTO(x, y, attackReq.indexPlayer, result));
        return res;
      });

      const enemyId = playersId.filter((playerId) => playerId !== attackReq.indexPlayer)[0];

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
      const result = 'miss';

      playersId.forEach((playerId) => {
        const res = sendAttackResponseForPlayerWithId(
          playerId,
          getAttackDTO(x, y, randomAttackRequestDTO.indexPlayer, result),
        );
        return res;
      });

      const enemyId = playersId.filter((playerId) => playerId !== randomAttackRequestDTO.indexPlayer)[0];

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
}
