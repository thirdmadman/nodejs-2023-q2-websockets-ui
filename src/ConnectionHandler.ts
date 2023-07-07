import { WebSocket, WebSocketServer } from 'ws';
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

export class ConnectionHandler {
  private ws: WebSocket;

  private wsServer: WebSocketServer;

  private router: Router = new Router();

  private playerId = -1;

  constructor(webSocket: WebSocket, webSocketServer: WebSocketServer) {
    this.ws = webSocket;
    this.wsServer = webSocketServer;

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

        const resp: CommunicationDTO = {
          type: 'reg',
          data: JSON.stringify(respData),
          id: 0,
        };

        ws.send(JSON.stringify(resp));
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
      }
    };

    const processAddUserToRoom = (ws: WebSocket, messageData: string) => {
      console.log(messageData);
      if (this.getPlayerId() < 0) {
        return;
      }

      const addPlayerDTO = JSON.parse(messageData) as AddPlayerDTO;
      if (!addPlayerDTO || addPlayerDTO.indexRoom === undefined) {
        return;
      }
      const foundRoom = roomRepository.findOne(addPlayerDTO.indexRoom);
      console.log(foundRoom);

      if (!foundRoom) {
        return;
      }

      if (!foundRoom.playersId || foundRoom.playersId.length >= 2) {
        return;
      }

      if (foundRoom.playersId[0] === this.getPlayerId()) {
        return;
      }

      console.log(foundRoom);

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
        idPlayer: enemyId,
      };

      const enemyCreateGameDTO: CreateGameDTO = {
        idGame: createGameResult.id,
        idPlayer: this.getPlayerId(),
      };

      try {
        const playerCreateGameDTOString = JSON.stringify(playerCreateGameDTO);
        const enemyCreateGameDTOString = JSON.stringify(enemyCreateGameDTO);

        this.sendToPlayer('create_game', playerCreateGameDTOString);
        this.onSendMessageToPlayerWithId(enemyId, 'create_game', enemyCreateGameDTOString);
      } catch (e) {
        console.log(e);
      }
    };

    const { router } = this;

    router.addRoute('reg', (ws: WebSocket, messageData: string) => processReg(ws, messageData));
    router.addRoute('create_room', (ws: WebSocket, messageData: string) => processCreateRoom(ws, messageData));
    router.addRoute('add_user_to_room', (ws: WebSocket, messageData: string) => processAddUserToRoom(ws, messageData));
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
      console.log('received: %s', message.data);

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
    console.log('sendToPlayer:');
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
