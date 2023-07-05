import { ShipDTO } from '../ShipDTO';

export interface StartGameDTO {
  ships: Array<ShipDTO>;
  currentPlayerIndex: number;
}
