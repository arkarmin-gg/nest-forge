import { AsyncLocalStorage } from 'async_hooks';
import { EntityManager } from 'typeorm';

const asyncLocalStorage = new AsyncLocalStorage<EntityManager>();

export class TransactionContext {
  static run<T>(manager: EntityManager, fn: () => Promise<T>): Promise<T> {
    return asyncLocalStorage.run(manager, fn);
  }

  static getManager(): EntityManager | undefined {
    return asyncLocalStorage.getStore();
  }

  static hasActive(): boolean {
    return asyncLocalStorage.getStore() !== undefined;
  }
}
