import { IEntity } from './IEntity';

export interface IPlayer extends IEntity {
  name: string;
  password: string;
  score: number;
}
