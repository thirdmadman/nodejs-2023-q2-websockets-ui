import { ShipDTO } from '../ShipDTO';

export interface AddShipsDTO {
  gameId: number;
  ships: Array<ShipDTO>;
  indexPlayer: number;
}
