export interface IGame {
  id: number;
  playersId: Array<number>;
  currentTurnPlayerId: number;
  isFinished: boolean;
}
