import { WebSocket } from 'ws';
import { PlayerRequestDTO } from '../dto/request/PlayerRequestDTO';
import { AddPlayerDTO } from '../dto/request/AddPlayerDTO';
import { AddShipsDTO } from '../dto/request/AddShipsDTO';
import { AttackRequestDTO } from '../dto/request/AttackRequestDTO';
import { CreateRoomDTO } from '../dto/request/CreateRoomDTO';

export type MessageData = AddPlayerDTO | AddShipsDTO | AttackRequestDTO | CreateRoomDTO | PlayerRequestDTO;
export type RouterCallback = (ws: WebSocket, messageData: string) => void;

export interface IRouteObject {
  route: string;
  callback: RouterCallback;
}
