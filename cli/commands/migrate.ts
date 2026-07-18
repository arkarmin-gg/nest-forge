import { spawnSync } from 'child_process';
import { Command } from 'commander';
import { confirmDestructive, requireBuild } from '../utils';

const DEV_DATA_SOURCE = 'src/data-source.ts';
const PROD_DATA_SOURCE = 'dist/src/data-source.js';
const MIGRATIONS_DIR = 'src/infrastructure/database/migrations';

function typeormDev(args: string[]): void {
  const result = spawnSync(
    'ts-node',
    ['-r', 'tsconfig-paths/register', './node_modules/typeorm/cli.js', ...args],
    { stdio: 'inherit', shell: true },
  );
  process.exit(result.status ?? 0);
}

function typeormProd(args: string[]): void {
  requireBuild(PROD_DATA_SOURCE);
  const result = spawnSync('node_modules/.bin/typeorm', args, {
    stdio: 'inherit',
    shell: true,
  });
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
      typeormDev([
        'migration:generate',
        `${MIGRATIONS_DIR}/${name}`,
        '-d',
        DEV_DATA_SOURCE,
      ]);
    });

  migrate
    .command('run')
    .description('Run all pending migrations')
    .option('--prod', 'Run against the compiled production build')
    .action((opts: { prod?: boolean }) => {
      if (opts.prod) {
        typeormProd(['migration:run', '-d', PROD_DATA_SOURCE]);
      } else {
        typeormDev(['migration:run', '-d', DEV_DATA_SOURCE]);
      }
    });

  migrate
    .command('revert')
    .description('Revert the last applied migration')
    .option('--prod', 'Revert against the compiled production build')
    .option('-y, --yes', 'Skip the production confirmation prompt')
    .action(async (opts: { prod?: boolean; yes?: boolean }) => {
      if (opts.prod) {
        await confirmDestructive(!!opts.yes);
        typeormProd(['migration:revert', '-d', PROD_DATA_SOURCE]);
      } else {
        typeormDev(['migration:revert', '-d', DEV_DATA_SOURCE]);
      }
    });

  migrate
    .command('status')
    .description('Show applied and pending migrations')
    .option('--prod', 'Check status against the compiled production build')
    .action((opts: { prod?: boolean }) => {
      if (opts.prod) {
        typeormProd(['migration:show', '-d', PROD_DATA_SOURCE]);
      } else {
        typeormDev(['migration:show', '-d', DEV_DATA_SOURCE]);
      }
    });
}
