import { IEntity } from './IEntity';

export interface IRoom extends IEntity {
  playersId: Array<number>;
  isInGame: boolean;
  ownerPlayerId: number;
}
