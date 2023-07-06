import { IGame } from '../interfaces/IGame';
import { IGameField } from '../interfaces/IGameField';
import { IPlayer } from '../interfaces/IPlayer';
import { IRoom } from '../interfaces/IRoom';

export interface DB {
  player: Array<IPlayer>;
  room: Array<IRoom>;
  gameField: Array<IGameField>;
  game: Array<IGame>;
}
export const db: DB = {
  player: Array<IPlayer>(),
  room: Array<IRoom>(),
  gameField: Array<IGameField>(),
  game: Array<IGame>(),
};
