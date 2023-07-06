import { IGameField } from './../interfaces/IGameField';
import { GenericRepository } from './GenericRepository';

class GameFieldRepository extends GenericRepository<IGameField> {}
export const gameFieldRepository = new GameFieldRepository('gameField');
