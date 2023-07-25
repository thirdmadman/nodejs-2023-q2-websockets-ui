import { WebSocket, WebSocketServer } from 'ws';
import { FinishGameDTO } from './dto/response/FinishGameDTO';
import { ChangePlayerTurnDTO } from './dto/response/ChangePlayerTurnDTO';
import { gameFieldRepository } from './repository/GameFieldRepository';
import { CreateGameDTO } from './dto/response/CreateGameDTO';
import { AllCommunicationDTOTypes, CommunicationDTO, CommunicationDTOTypes } from './dto/CommunicationDTO';
import { PlayerResponseDTO } from './dto/response/PlayerResponseDTO';
import { IPlayer } from './interfaces/IPlayer';
import { playerRepository } from './repository/PlayerRepository';
import { IRoom } from './interfaces/IRoom';
import { roomRepository } from './repository/RoomRepository';
import { RoomDTO, RoomUser } from './dto/response/RoomDTO';
import { Router } from './Router';
import { IGame } from './interfaces/IGame';
import { gameRepository } from './repository/GameRepository';
import { IGameField } from './interfaces/IGameField';
import { StartGameDTO } from './dto/response/StartGameDTO';
import { AttackRequestDTO } from './dto/request/AttackRequestDTO';
import { AttackResponseDTO, TAttackStatus } from './dto/response/AttackResponseDTO';
import { RandomAttackRequestDTO } from './dto/request/RandomAttackRequestDTO';
import { WinnerDTO } from './dto/response/WinnerDTO';
import { PlayerService } from './services/PlayerService';
import { RoomService } from './services/RoomService';
import { GameService } from './services/GameService';
import { GameFieldService } from './services/GameFieldService';

export class ConnectionHandler {
  private ws: WebSocket;

  private wsServer: WebSocketServer;

  private router: Router = new Router();

  private playerId = -1;

  constructor(webSocket: WebSocket, webSocketServer: WebSocketServer) {
    this.ws = webSocket;
    this.wsServer = webSocketServer;

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
      const playerService = new PlayerService();

      const playerDTO = playerService.convertPlayerRegRequest(messageData);

      if (!playerDTO) {
        return;
      }

      const existingPlayer = playerRepository.findPlayerByName(playerDTO.name);
      const isPlayerExist = existingPlayer !== null;

      if (isPlayerExist) {
        if (existingPlayer.password !== playerDTO.password) {
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
        this.updateRooms();
        this.updateWinners();
        return;
      }

      const registerResult = playerService.registerPlayer(playerDTO);

      if (registerResult) {
        this.updateRooms();
        this.updateWinners();
        sendRegSuccess(registerResult);
      }
    };

    const processCreateRoom = (ws: WebSocket, messageData: string) => {
      if (this.getPlayerId() < 0) {
        return;
      }

      const currentRoom = roomRepository.findAllOwnRoomsByPlayerId(this.getPlayerId());

      if (!currentRoom) {
        const newRoom: IRoom = { id: 0, playersId: [this.playerId], isInGame: false, ownerPlayerId: this.playerId };
        const result = roomRepository.create(newRoom);

        if (result) {
          this.updateRooms();
        }
      }
    };

    const processAddUserToRoom = (ws: WebSocket, messageData: string) => {
      if (this.getPlayerId() < 0) {
        return;
      }

      const roomService = new RoomService();

      const addPlayerDTO = roomService.convertAddPlayerRequest(messageData);

      if (!addPlayerDTO) {
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

      const gameService = new GameService();
      const createGameResult = gameService.createNewGame(enemyId, this.getPlayerId());

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
        console.error(e);
      }

      this.updateRooms();
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

      const gameFieldService = new GameFieldService();
      const gameFieldResult = gameFieldService.createGameField(messageData, this.getPlayerId());

      if (!gameFieldResult) {
        return;
      }

      const game = gameRepository.findOne(gameFieldResult.gameId);

      if (!game) {
        return;
      }

      const isEnemyReady = gameFieldService.getIsEnemyReady(gameFieldResult.gameId, this.getPlayerId());

      if (!isEnemyReady) {
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

    const markAllNeighborCellsAsMiss = (attackedPlayerGameField: IGameField, xAttack: number, yAttack: number) => {
      const gameFieldService = new GameFieldService();
      const allCellsAroundShip = gameFieldService.getAllCellsAroundShip(attackedPlayerGameField, xAttack, yAttack);

      if (!allCellsAroundShip) {
        return;
      }

      const newGameField = { ...attackedPlayerGameField };

      newGameField.enemyAttacks = [...newGameField.enemyAttacks, ...allCellsAroundShip];

      gameFieldRepository.update(newGameField.id, newGameField);

      const game = gameRepository.findOne(newGameField.gameId);

      if (!game) {
        return;
      }

      const { playersId } = game;

      const attackedPlayerId = attackedPlayerGameField.playerId;
      const attackerPlayerId = playersId.filter((id) => id !== attackedPlayerId)[0];

      allCellsAroundShip.forEach((attack) => {
        const attackedDTO = getAttackDTO(attack.position.x, attack.position.y, attackerPlayerId, 'miss');
        sendAttackResponseForPlayerWithId(attackedPlayerId, attackedDTO);

        const attackerDTO = getAttackDTO(attack.position.x, attack.position.y, attackerPlayerId, 'miss');
        sendAttackResponseForPlayerWithId(attackerPlayerId, attackerDTO);
      });
    };

    const markShipAsDead = (attackedPlayerGameField: IGameField, xAttack: number, yAttack: number) => {
      const gameFieldService = new GameFieldService();
      const shipCells = gameFieldService.getAllShipCells(attackedPlayerGameField, xAttack, yAttack);

      if (!shipCells) {
        return;
      }

      const game = gameRepository.findOne(attackedPlayerGameField.gameId);

      if (!game) {
        return;
      }

      const { playersId } = game;

      const attackedPlayerId = attackedPlayerGameField.playerId;
      const attackerPlayerId = playersId.filter((id) => id !== attackedPlayerId)[0];

      shipCells.forEach((attack) => {
        const attackedDTO = getAttackDTO(attack.position.x, attack.position.y, attackerPlayerId, 'killed');
        sendAttackResponseForPlayerWithId(attackedPlayerId, attackedDTO);

        const attackerDTO = getAttackDTO(attack.position.x, attack.position.y, attackerPlayerId, 'killed');
        sendAttackResponseForPlayerWithId(attackerPlayerId, attackerDTO);
      });
    };

    const processAttack = (ws: WebSocket, messageData: string) => {
      if (this.playerId === -1) {
        return;
      }

      const gameFieldService = new GameFieldService();

      const attackReq = JSON.parse(messageData) as AttackRequestDTO;
      const { gameId, x, y, indexPlayer } = attackReq;

      if (gameId === undefined || x === undefined || y === undefined || indexPlayer === undefined) {
        return;
      }

      const game = gameRepository.findOne(gameId);

      if (!game) {
        return;
      }

      if (game.currentTurnPlayerId !== this.getPlayerId()) {
        return;
      }

      const { playersId } = game;
      if (!playersId || playersId.length !== 2) {
        return;
      }

      const enemyId = playersId.filter((playerId) => playerId !== attackReq.indexPlayer)[0];

      let enemyGameField = gameFieldRepository.findGameFieldByGameIdAndPlayerId(gameId, enemyId);

      if (!enemyGameField) {
        return;
      }

      const isAttackExists = gameFieldService.getIsAttackExists(x, y, enemyGameField.enemyAttacks);

      const result = gameFieldService.getAttackResult(enemyGameField, x, y);

      playersId.forEach((playerId) => {
        const res = sendAttackResponseForPlayerWithId(playerId, getAttackDTO(x, y, attackReq.indexPlayer, result));
        return res;
      });

      if (!isAttackExists) {
        enemyGameField.enemyAttacks = [...enemyGameField.enemyAttacks, { position: { x, y } }];

        const newGameField = gameFieldRepository.update(enemyGameField.id, enemyGameField);

        if (!newGameField) {
          return;
        }

        enemyGameField = newGameField;

        if (result === 'killed') {
          markAllNeighborCellsAsMiss(newGameField, x, y);
          markShipAsDead(newGameField, x, y);
        }
      }

      if (gameFieldService.getIsAllShipsAreDead(enemyGameField)) {
        this.finishGame(game.id);
        if (enemyId !== -100) {
          this.updateWinnerPlayerScore(this.getPlayerId());
        }
        this.sendPlayerWin(game.id, this.getPlayerId());
        return;
      }

      if (result === 'killed' || result === 'shot') {
        playersId.forEach((playerId) => {
          const res = sendPlayerTurnByPlayerId(this.getPlayerId(), playerId);
          return res;
        });
        return;
      }

      if (enemyId === -100) {
        const performBotAttack = () => {
          sendPlayerTurnByPlayerId(-100, this.getPlayerId());

          const playerGameField = gameFieldRepository.findGameFieldByGameIdAndPlayerId(game.id, this.getPlayerId());

          if (!playerGameField) {
            return null;
          }

          const botRandomAttack = gameFieldService.getRandomAttackByPlayerIdAndGameId(this.getPlayerId(), game.id);
          if (!botRandomAttack) {
            return null;
          }

          const botAttackResult = gameFieldService.getAttackResult(
            playerGameField,
            botRandomAttack.x,
            botRandomAttack.y,
          );

          playerGameField.enemyAttacks = [
            ...playerGameField.enemyAttacks,
            { position: { x: botRandomAttack.x, y: botRandomAttack.y } },
          ];

          const newPlayerGameField = gameFieldRepository.update(playerGameField.id, playerGameField);

          if (!newPlayerGameField) {
            return null;
          }

          sendAttackResponseForPlayerWithId(
            this.getPlayerId(),
            getAttackDTO(botRandomAttack.x, botRandomAttack.y, -100, botAttackResult),
          );

          if (botAttackResult === 'killed') {
            markAllNeighborCellsAsMiss(newPlayerGameField, botRandomAttack.x, botRandomAttack.y);
            markShipAsDead(newPlayerGameField, botRandomAttack.x, botRandomAttack.y);
          }

          return botAttackResult;
        };

        let resultOfCurrentBotAttack = performBotAttack();

        while (resultOfCurrentBotAttack === 'killed' || resultOfCurrentBotAttack === 'shot') {
          resultOfCurrentBotAttack = performBotAttack();

          const playerGameField = gameFieldRepository.findGameFieldByGameIdAndPlayerId(game.id, this.getPlayerId());

          if (playerGameField && gameFieldService.getIsAllShipsAreDead(playerGameField)) {
            this.finishGame(game.id);
            this.sendPlayerWin(game.id, -100);
            return;
          }
        }

        sendPlayerTurnByPlayerId(this.getPlayerId(), this.getPlayerId());
        return;
      }

      const gameService = new GameService();

      const updatedGame = gameService.changePlayerTurn(game.id);
      if (!updatedGame) {
        return;
      }
      playersId.forEach((playerId) => {
        const res = sendPlayerTurnByPlayerId(updatedGame.currentTurnPlayerId, playerId);
        return res;
      });
    };

    const processRandomAttack = (ws: WebSocket, messageData: string) => {
      const randomAttackRequestDTO = JSON.parse(messageData) as RandomAttackRequestDTO;
      const gameFieldService = new GameFieldService();

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

      const generatedAttack = gameFieldService.getRandomAttackByPlayerIdAndGameId(
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

      const result = gameFieldService.getAttackResult(enemyGameField, x, y);

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

      if (result === 'killed') {
        markAllNeighborCellsAsMiss(newGameField, x, y);
        markShipAsDead(newGameField, x, y);
      }

      if (gameFieldService.getIsAllShipsAreDead(enemyGameField)) {
        this.finishGame(game.id);
        this.updateWinnerPlayerScore(this.getPlayerId());
        this.sendPlayerWin(game.id, this.getPlayerId());
        return;
      }

      const gameService = new GameService();

      const updatedGame = gameService.changePlayerTurn(game.id);
      if (!updatedGame) {
        return;
      }

      playersId.forEach((playerId) => {
        const res = sendPlayerTurnByPlayerId(updatedGame.currentTurnPlayerId, playerId);
        return res;
      });
    };

    const processStartSinglePlay = (ws: WebSocket, messageData: string) => {
      const game: IGame = {
        id: 0,
        playersId: [-100, this.getPlayerId()],
        currentTurnPlayerId: this.getPlayerId(),
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

      try {
        const playerCreateGameDTOString = JSON.stringify(playerCreateGameDTO);
        this.sendToPlayer('create_game', playerCreateGameDTOString);
      } catch (e) {
        console.error(e);
      }

      const botGameField: IGameField = {
        id: 0,
        gameId: createGameResult.id,
        playerId: -100,
        ships: [
          { position: { x: 2, y: 5 }, direction: false, type: 'huge', length: 4 },
          { position: { x: 7, y: 5 }, direction: true, type: 'large', length: 3 },
          { position: { x: 1, y: 8 }, direction: false, type: 'large', length: 3 },
          { position: { x: 9, y: 3 }, direction: true, type: 'medium', length: 2 },
          { position: { x: 7, y: 0 }, direction: true, type: 'medium', length: 2 },
          { position: { x: 9, y: 0 }, direction: true, type: 'medium', length: 2 },
          { position: { x: 2, y: 3 }, direction: false, type: 'small', length: 1 },
          { position: { x: 0, y: 1 }, direction: false, type: 'small', length: 1 },
          { position: { x: 6, y: 3 }, direction: true, type: 'small', length: 1 },
          { position: { x: 8, y: 9 }, direction: true, type: 'small', length: 1 },
        ],
        enemyAttacks: [],
      };

      gameFieldRepository.create(botGameField);
    };

    const { router } = this;

    router.addRoute('reg', (ws: WebSocket, messageData: string) => processReg(ws, messageData));
    router.addRoute('create_room', (ws: WebSocket, messageData: string) => processCreateRoom(ws, messageData));
    router.addRoute('add_user_to_room', (ws: WebSocket, messageData: string) => processAddUserToRoom(ws, messageData));
    router.addRoute('add_ships', (ws: WebSocket, messageData: string) => processAddShips(ws, messageData));
    router.addRoute('attack', (ws: WebSocket, messageData: string) => processAttack(ws, messageData));
    router.addRoute('randomAttack', (ws: WebSocket, messageData: string) => processRandomAttack(ws, messageData));
    router.addRoute('single_play', (ws: WebSocket, messageData: string) => processStartSinglePlay(ws, messageData));
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

      console.log(`received from playerId= ${this.getPlayerId()}: `, message);

      this.router.handle(message.type, this.ws, message.data);
    } catch (e) {
      console.error(e);
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
          console.log(resp);
        } catch (e) {
          console.error(e);
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
      console.log(resp);
    } catch (e) {
      console.error(e);
    }
  }

  updateRooms() {
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

    const roomsDTO = rooms.map((room) => ({ roomId: room.id, roomUsers: roomPlayers(room) }) as RoomDTO);
    try {
      const roomsDTOSting = JSON.stringify(roomsDTO);
      this.sendToAll('update_room', roomsDTOSting);
    } catch (err) {
      console.error(err);
    }
  }

  finishGame(gameId: number) {
    const game = gameRepository.findGameByPlayerId(gameId);

    if (!game) {
      return;
    }

    if (!game.playersId || game.playersId.length !== 2) {
      return;
    }

    game.isFinished = true;

    gameRepository.update(game.id, game);
  }

  updateWinnerPlayerScore(winnerPlayerId: number) {
    const player = playerRepository.findOne(winnerPlayerId);

    if (!player) {
      return;
    }

    player.score += 1;

    playerRepository.update(player.id, { ...player });
  }

  onClose() {
    const playerId = this.getPlayerId();
    if (playerId === -1) {
      return;
    }

    const existingPlayer = playerRepository.findOne(playerId);

    if (existingPlayer) {
      existingPlayer.isOnline = false;
      playerRepository.update(existingPlayer.id, existingPlayer);
    }

    const closeOwnRoom = (playerIdToClose: number) => {
      const rooms = roomRepository.findAllOwnRoomsByPlayerId(playerIdToClose);

      if (!rooms) {
        return;
      }

      rooms.forEach((room) => roomRepository.delete(room.id));

      this.updateRooms();
    };

    const looseAndFinishCurrentGame = (playerIdToLoose: number) => {
      const game = gameRepository.findGameByPlayerId(playerIdToLoose);
      if (!game) {
        return;
      }

      const enemyId = game.playersId.filter((player) => player !== playerId)[0];

      this.finishGame(game.id);
      this.updateWinnerPlayerScore(enemyId);
      this.sendPlayerWin(game.id, enemyId);
    };

    closeOwnRoom(playerId);

    looseAndFinishCurrentGame(playerId);
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
      .sort((a, b) => b.wins - a.wins);

    try {
      const winnersDTOString = JSON.stringify(winnersDTO);
      this.sendToAll('update_winners', winnersDTOString);
    } catch (err) {
      console.error(err);
    }
  }
}
