import { IEntity } from './IEntity';

export interface IGame extends IEntity {
  playersId: Array<number>;
  currentTurnPlayerId: number;
  isFinished: boolean;
}
