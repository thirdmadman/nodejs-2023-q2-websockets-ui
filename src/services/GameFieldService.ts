import { AddShipsDTO } from '../dto/request/AddShipsDTO';
import { IGameField, IGameFieldEnemyAttack } from '../interfaces/IGameField';
import { gameFieldRepository } from '../repository/GameFieldRepository';
import { gameRepository } from '../repository/GameRepository';
import { getRandomInt } from '../utils/utils';

export interface TGameFieldCell {
  shipIndex: number;
  isHit: boolean;
  isMiss: boolean;
}

export class GameFieldService {
  convertGameFieldMessage(message: string) {
    try {
      const addShipsDTO = JSON.parse(message) as AddShipsDTO;
      if (!addShipsDTO || addShipsDTO.gameId === undefined || addShipsDTO.indexPlayer === undefined) {
        return null;
      }

      if (addShipsDTO.ships === undefined || addShipsDTO.ships.length < 0 || addShipsDTO.ships.length !== 10) {
        return null;
      }

      return addShipsDTO;
    } catch (e) {
      console.error(e);
    }
    return null;
  }

  createGameField(message: string, playerId: number) {
    const addShipsDTO = this.convertGameFieldMessage(message);

    if (!addShipsDTO || addShipsDTO.indexPlayer !== playerId) {
      return null;
    }

    const gameField: IGameField = {
      id: 0,
      gameId: addShipsDTO.gameId,
      playerId,
      ships: [...addShipsDTO.ships],
      enemyAttacks: new Array<IGameFieldEnemyAttack>(),
    };

    return gameFieldRepository.create(gameField);
  }

  getIsEnemyReady(gameId: number, currentPlayerId: number) {
    const game = gameRepository.findOne(gameId);

    if (!game) {
      return false;
    }

    const enemyId = game.playersId.filter((playerId) => playerId !== currentPlayerId);

    if (!enemyId || enemyId.length === 0) {
      return false;
    }

    const enemyGameField = gameFieldRepository.findGameFieldByGameIdAndPlayerId(game.id, enemyId[0]);

    if (!enemyGameField) {
      return false;
    }

    return true;
  }

  getConvertedGameField(attackedPlayerGameField: IGameField) {
    const { ships, enemyAttacks } = attackedPlayerGameField;

    const copy = new Array<TGameFieldCell | null>(10);
    const nodes = new Array<typeof copy>(10);

    for (let i = 0; i < 10; i++) {
      copy[i] = null;
    }

    for (let i = 0; i < nodes.length; i++) {
      nodes[i] = copy.slice(0);
    }

    const gameField = nodes;

    ships.forEach((ship, index) => {
      for (let i = 0; i < ship.length; i += 1) {
        if (ship.direction) {
          gameField[ship.position.x][ship.position.y + i] = {
            shipIndex: index,
            isHit: false,
            isMiss: false,
          };
        } else {
          gameField[ship.position.x + i][ship.position.y] = {
            shipIndex: index,
            isHit: false,
            isMiss: false,
          };
        }
      }
    });

    enemyAttacks.forEach((attack) => {
      if (gameField[attack.position.x][attack.position.y]) {
        const cell = gameField[attack.position.x][attack.position.y];
        if (cell) {
          cell.isHit = true;
        } else {
          gameField[attack.position.x][attack.position.y] = {
            shipIndex: -1,
            isHit: false,
            isMiss: true,
          };
        }
      }
    });

    return gameField;
  }

  getAllShipCells(attackedPlayerGameField: IGameField, xAttack: number, yAttack: number) {
    const gameField = this.getConvertedGameField(attackedPlayerGameField);

    const cell = gameField[xAttack][yAttack];

    if (!cell) {
      return null;
    }

    const { shipIndex } = cell;

    const ship = attackedPlayerGameField.ships[shipIndex];

    if (ship.length === 1) {
      return null;
    }

    const shipCells = new Array<IGameFieldEnemyAttack>();

    for (let i = 0; i < ship.length; i++) {
      if (ship.direction) {
        shipCells.push({ position: { x: ship.position.x, y: ship.position.y + i } });
      } else {
        shipCells.push({ position: { x: ship.position.x + i, y: ship.position.y } });
      }
    }
    return shipCells;
  }

  getIsAllShipsAreDead(attackedPlayerGameField: IGameField) {
    const { ships } = attackedPlayerGameField;

    const gameField = this.getConvertedGameField(attackedPlayerGameField);

    let shipDeadCount = 0;

    for (let i = 0; i < ships.length; i += 1) {
      const shipCells = gameField.flat().filter((cell) => cell?.shipIndex === i);
      const intactCells = shipCells.filter((cell) => cell?.isHit === false);
      if (!intactCells || intactCells.length === 0) {
        shipDeadCount += 1;
      }
    }
    return shipDeadCount >= 10;
  }

  getAllCellsAroundShip(attackedPlayerGameField: IGameField, xAttack: number, yAttack: number) {
    const gameFieldService = new GameFieldService();
    const gameField = gameFieldService.getConvertedGameField(attackedPlayerGameField);

    const cell = gameField[xAttack][yAttack];

    if (!cell) {
      return null;
    }

    const { shipIndex } = cell;

    const ship = attackedPlayerGameField.ships[shipIndex];

    const isVertical = ship.direction;

    let maxHorizontal = isVertical ? ship.position.x + 2 : ship.position.x + ship.length + 1;
    maxHorizontal = maxHorizontal > 10 ? 10 : maxHorizontal;

    let maxVertical = isVertical ? ship.position.y + ship.length + 1 : ship.position.y + 2;
    maxVertical = maxVertical > 10 ? 10 : maxVertical;

    const minHorizontal = ship.position.x > 0 ? ship.position.x - 1 : 0;
    const minVertical = ship.position.y > 0 ? ship.position.y - 1 : 0;

    const newAttacks = new Array<IGameFieldEnemyAttack>();

    for (let xSearch = minHorizontal; xSearch < maxHorizontal; xSearch += 1) {
      for (let ySearch = minVertical; ySearch < maxVertical; ySearch += 1) {
        if (gameField[xSearch] && gameField[xSearch][ySearch] !== undefined) {
          const cellFound = gameField[xSearch][ySearch];
          if (cellFound === null) {
            newAttacks.push({ position: { x: xSearch, y: ySearch } });
          }
        }
      }
    }

    return newAttacks;
  }

  getAttackResult(attackedPlayerGameField: IGameField, xAttack: number, yAttack: number) {
    const { ships } = attackedPlayerGameField;
    const gameField = this.getConvertedGameField(attackedPlayerGameField);

    const cell = gameField[xAttack][yAttack];
    if (cell) {
      const ship = ships[cell.shipIndex];
      if (ship) {
        if (ship.length === 1) {
          return 'killed';
        }

        let foundCellsHitWithShipId = 0;

        for (let x = 0; x < gameField.length; x++) {
          for (let y = 0; y < gameField[x].length; y++) {
            const cellToFind = gameField[x][y];
            if (cellToFind) {
              if (cellToFind.shipIndex === cell.shipIndex && cellToFind.isHit) {
                foundCellsHitWithShipId += 1;
              }
            }
          }
        }

        if (foundCellsHitWithShipId + 1 >= ship.length) {
          return 'killed';
        }

        return 'shot';
      }
    }

    return 'miss';
  }

  getIsAttackExists(xFind: number, yFind: number, enemyAttacks: Array<IGameFieldEnemyAttack>) {
    const isHasBeenAttacked = enemyAttacks.find((attack) => attack.position.x === xFind && attack.position.y === yFind);
    return isHasBeenAttacked !== undefined;
  }

  getRandomAttackByPlayerIdAndGameId(playerId: number, gameId: number) {
    const gameField = gameFieldRepository.findGameFieldByGameIdAndPlayerId(gameId, playerId);

    if (!gameField) {
      return null;
    }

    let found = false;
    let counter = 0;

    let x = 0;
    let y = 0;

    while (!found) {
      x = getRandomInt(0, 9);
      y = getRandomInt(0, 9);

      found = !this.getIsAttackExists(x, y, gameField.enemyAttacks);
      counter += 1;

      if (counter > 99) {
        break;
      }
    }

    return { x, y };
  }
}
