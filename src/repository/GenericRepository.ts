/* eslint-disable class-methods-use-this */
import { DB, db } from '../db/db';

type Keys = keyof DB;
type ExtractArrayType<T> = T extends Array<infer U> ? U : never;
type DBArrays = (typeof db)[Keys];
type ExtractedType = ExtractArrayType<DBArrays>;

export class GenericRepository<TEntity extends ExtractedType> {
  private tableName: keyof DB;

  constructor(tableName: keyof DB) {
    this.tableName = tableName;
  }

  create(entity: TEntity) {
    let lastId = 0;
    const table = db[this.tableName] as Array<TEntity>;
    if (table && table.length > 0) {
      const lastRecord: TEntity = { ...table[table.length - 1] };
      lastId = lastRecord.id + 1;
    }
    entity.id = lastId;
    const newEntity: TEntity = { ...entity };
    table.push(newEntity);
    return entity;
  }

  findOne(id: number) {
    const table = db[this.tableName] as Array<TEntity>;
    if (table && table.length > 0) {
      const foundEntity = table.find((entity) => entity.id === id);
      if (foundEntity) {
        return { ...foundEntity };
      }
    }
    return null;
  }

  findAll() {
    const table = db[this.tableName] as Array<TEntity>;
    if (table && table.length > 0) {
      const entities = Array<TEntity>();
      for (let i = 0; table.length > i; i += 1) {
        const entity = table[i];
        if (entity) {
          entities.push({ ...entity });
        }
      }
      return entities;
    }
    return Array<TEntity>();
  }

  update(id: number, entity: TEntity) {
    const table = db[this.tableName] as Array<TEntity>;
    const index = table.findIndex((entityToFind) => entityToFind.id === id);
    if (index > -1) {
      const newEntity: TEntity = { ...entity };
      table[index] = newEntity;
      return { ...table[index] };
    }
    return null;
  }

  delete(id: number) {
    const table = db[this.tableName] as Array<TEntity>;
    const index = table.findIndex((entityToFind) => entityToFind.id === id);
    if (index > -1) {
      const oldEntity: TEntity = { ...table[index] };
      delete table[index];
      (db[this.tableName] as Array<TEntity>) = table.filter((entity) => entity);
      return oldEntity;
    }
    return null;
  }
}
