export interface IGameFieldShip {
  position: {
    x: number;
    y: number;
  };
  direction: boolean;
  length: number;
  type: 'small' | 'medium' | 'large' | 'huge';
}

export interface IGameFieldEnemyAttack {
  position: {
    x: number;
    y: number;
  };
}

export interface IGameField {
  id: number;
  gameId: number;
  userId: number;
  ships: Array<IGameFieldShip>;
  enemyAttacks: Array<IGameFieldEnemyAttack>;
}
