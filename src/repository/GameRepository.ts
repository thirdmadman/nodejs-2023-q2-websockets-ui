import { IGame } from '../interfaces/IGame';
import { GenericRepository } from './GenericRepository';

class GameRepository extends GenericRepository<IGame> {
  findGameByPlayerId(playerId: number) {
    const gameResult = this.findAll();

    if (!gameResult || gameResult.length === 0) {
      return null;
    }

    const foundGame = gameResult.find((game) => game.playersId.includes(playerId) && !game.isFinished);

    if (!foundGame) {
      return null;
    }

    return { ...foundGame };
  }
}
export const gameRepository = new GameRepository('game');
