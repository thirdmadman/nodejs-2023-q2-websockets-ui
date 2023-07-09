import { IPlayer } from '../interfaces/IPlayer';
import { GenericRepository } from './GenericRepository';

class PlayerRepository extends GenericRepository<IPlayer> {
  findPlayerByName(name: string) {
    const gameFieldResult = this.findAll();

    const res = gameFieldResult.find((player) => player.name === name);

    if (!res) {
      return null;
    }

    return { ...res } as IPlayer;
  }
}
export const playerRepository = new PlayerRepository('player');
