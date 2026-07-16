import { spawnSync } from 'child_process';
import { Command } from 'commander';

const DATA_SOURCE = 'src/data-source.ts';
const MIGRATIONS_DIR = 'src/infrastructure/database/migrations';

function typeorm(args: string[]): void {
  const result = spawnSync(
    'ts-node',
    ['-r', 'tsconfig-paths/register', './node_modules/typeorm/cli.js', ...args],
    { stdio: 'inherit', shell: true },
  );
  process.exit(result.status ?? 0);
}

export function registerMigrateCommands(db: Command): void {
  const migrate = db.command('migrate').description('Migration operations');

  migrate
    .command('generate <name>')
    .description(
      'Generate a new migration file into the enforced migrations directory',
    )
    .action((name: string) => {
      typeorm([
        'migration:generate',
        `${MIGRATIONS_DIR}/${name}`,
        '-d',
        DATA_SOURCE,
      ]);
    });

  migrate
    .command('run')
    .description('Run all pending migrations')
    .action(() => {
      typeorm(['migration:run', '-d', DATA_SOURCE]);
    });

  migrate
    .command('revert')
    .description('Revert the last applied migration')
    .action(() => {
      typeorm(['migration:revert', '-d', DATA_SOURCE]);
    });
}
