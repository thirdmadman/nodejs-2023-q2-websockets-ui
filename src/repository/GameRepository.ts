import { IGame } from './../interfaces/IGame';
import { GenericRepository } from './GenericRepository';

class GameRepository extends GenericRepository<IGame> {}
export const gameRepository = new GameRepository('game');
