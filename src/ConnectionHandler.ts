import { WebSocket, WebSocketServer } from 'ws';
import { v4 } from 'uuid';
import { AddPlayerDTO } from './dto/request/AddPlayerDTO';
import { AllCommunicationDTOTypes, CommunicationDTO } from './dto/CommunicationDTO';
import { PlayerRequestDTO } from './dto/request/PlayerRequestDTO';
import { PlayerResponseDTO } from './dto/response/PlayerResponseDTO';
import { IPlayer } from './interfaces/IPlayer';
import { playerRepository } from './repository/PlayerRepository';
import { IRoom } from './interfaces/IRoom';
import { roomRepository } from './repository/RoomRepository';
import { RoomDTO, RoomUser } from './dto/response/RoomDTO';
import { Router } from './Router';

export class ConnectionHandler {
  private ws: WebSocket;

  private wsServer: WebSocketServer;

  private router: Router = new Router();

  private userId: number;

  constructor(webSocket: WebSocket, webSocketServer: WebSocketServer) {
    this.ws = webSocket;
    this.wsServer = webSocketServer;

    // const id = v4();
    // console.log(id);
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
        this.userId = newPlayer.id;
      }
    };

    const processCreateRoom = (ws: WebSocket, messageData: string) => {
      // const playerReq = JSON.parse(messageData) as PlayerRequestDTO;
      const newRoom: IRoom = { id: 0, playersId: [this.userId], isInGame: false };
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

        const resp: CommunicationDTO = {
          type: 'update_room',
          data: JSON.stringify(roomsDTO),
          id: 0,
        };
        this.sendToAll(JSON.stringify(resp));
        // ws.send(JSON.stringify(resp));
      }
    };

    const processAddUserToRoom = (ws: WebSocket, messageData: string) => {
      const addPlayerDTO = JSON.parse(messageData) as AddPlayerDTO;
      if (!addPlayerDTO || !addPlayerDTO.indexRoom) {
        return;
      }
      const foundRoom = roomRepository.findOne(addPlayerDTO.indexRoom);

      if (!foundRoom) {
        return;
      }

      if (!foundRoom.playersId || foundRoom.playersId.length >= 2) {
        return;
      }

      foundRoom.playersId = roomRepository.findOne;
    };

    this.router.addRoute('reg', (ws: WebSocket, messageData: string) => processReg(ws, messageData));
    this.router.addRoute('create_room', (ws: WebSocket, messageData: string) => processCreateRoom(ws, messageData));
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

  sendToAll(message: string) {
    this.wsServer.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}
