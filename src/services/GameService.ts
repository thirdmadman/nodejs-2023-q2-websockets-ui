import { IGame } from '../interfaces/IGame';
import { gameRepository } from '../repository/GameRepository';

export class GameService {
  createNewGame(enemyId: number, playerId: number) {
    const game: IGame = {
      id: 0,
      playersId: [enemyId, playerId],
      currentTurnPlayerId: enemyId,
      isFinished: false,
    };

    return gameRepository.create(game);
  }

  changePlayerTurn(gameId: number) {
    const game = gameRepository.findOne(gameId);

    if (!game) {
      return null;
    }

    const { playersId } = game;

    if (!playersId || playersId.length !== 2) {
      return null;
    }

    const { currentTurnPlayerId } = game;

    const nextPlayerIdInGame = playersId.find((id) => id !== currentTurnPlayerId);

    if (nextPlayerIdInGame === undefined) {
      return null;
    }

    game.currentTurnPlayerId = nextPlayerIdInGame;

    return gameRepository.update(gameId, { ...game });
  }
}
