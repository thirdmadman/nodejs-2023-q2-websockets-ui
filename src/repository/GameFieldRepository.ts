import { IGameField } from '../interfaces/IGameField';
import { GenericRepository } from './GenericRepository';

class GameFieldRepository extends GenericRepository<IGameField> {
  findAllGameFieldByGameId(gameId: number) {
    const gameFieldResult = this.findAll();

    if (!gameFieldResult || gameFieldResult.length === 0) {
      return null;
    }

    const foundGameField = gameFieldResult.filter((gameField) => gameField.gameId === gameId);

    if (!foundGameField || foundGameField.length === 0) {
      return null;
    }

    return foundGameField;
  }

  findGameFieldByGameIdAndPlayerId(gameId: number, playerId: number) {
    const gameFieldResult = this.findAllGameFieldByGameId(gameId);

    if (!gameFieldResult || gameFieldResult.length === 0) {
      return null;
    }

    const foundGameField = gameFieldResult.find((gameField) => gameField.playerId === playerId);

    if (!foundGameField) {
      return null;
    }

    return { ...foundGameField } as IGameField;
  }
}
export const gameFieldRepository = new GameFieldRepository('gameField');
