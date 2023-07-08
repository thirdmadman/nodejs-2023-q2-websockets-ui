import { IEntity } from './IEntity';

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

export interface IGameField extends IEntity {
  gameId: number;
  playerId: number;
  ships: Array<IGameFieldShip>;
  enemyAttacks: Array<IGameFieldEnemyAttack>;
}
