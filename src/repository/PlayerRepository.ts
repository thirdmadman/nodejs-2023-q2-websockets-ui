import { IPlayer } from '../interfaces/IPlayer';
import { GenericRepository } from './GenericRepository';

class PlayerRepository extends GenericRepository<IPlayer> {}
export const playerRepository = new PlayerRepository('player');
