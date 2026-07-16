import { Command } from 'commander';
import { registerMigrateCommands } from './migrate';
import { registerSeedCommands } from './seed';

export function registerDbCommand(program: Command): void {
  const db = program.command('db').description('Database operations');
  registerMigrateCommands(db);
  registerSeedCommands(db);
}
