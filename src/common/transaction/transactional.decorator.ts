import { DataSource } from 'typeorm';
import { TransactionContext } from './transaction.context';

export function Transactional(): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const original = descriptor.value as (
      ...args: unknown[]
    ) => Promise<unknown>;

    descriptor.value = async function (
      this: { dataSource?: DataSource },
      ...args: unknown[]
    ) {
      // REQUIRED propagation: reuse existing transaction if one is active
      if (TransactionContext.hasActive()) {
        return original.apply(this, args);
      }

      if (!this.dataSource) {
        throw new Error(
          `@Transactional() on '${String(propertyKey)}' requires a 'dataSource' property on the class. ` +
            `Inject it with: @InjectDataSource() private readonly dataSource: DataSource`,
        );
      }

      return this.dataSource.transaction((manager) =>
        TransactionContext.run(manager, () => original.apply(this, args)),
      );
    };

    return descriptor;
  };
}
