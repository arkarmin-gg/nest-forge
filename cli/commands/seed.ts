import { spawnSync } from 'child_process';
import { Command } from 'commander';
import { confirmDestructive, requireBuild } from '../utils';

const DEV_SCRIPTS = {
  seed: 'src/seeders/seed.ts',
  clear: 'src/seeders/clear.ts',
};

const PROD_SCRIPTS = {
  seed: 'dist/src/seeders/seed.js',
  clear: 'dist/src/seeders/clear.js',
};

function runDev(script: string): number {
  const result = spawnSync(
    'ts-node',
    ['-r', 'tsconfig-paths/register', script],
    { stdio: 'inherit', shell: true },
  );
  return result.status ?? 0;
}

function runProd(script: string): number {
  requireBuild(script);
  const result = spawnSync('node', [script], { stdio: 'inherit', shell: true });
  return result.status ?? 0;
}

function run(script: keyof typeof DEV_SCRIPTS, prod: boolean): number {
  return prod ? runProd(PROD_SCRIPTS[script]) : runDev(DEV_SCRIPTS[script]);
}

export function registerSeedCommands(db: Command): void {
  db.command('seed')
    .description('Run all database seeders')
    .option('--prod', 'Run against the compiled production build')
    .action((opts: { prod?: boolean }) => {
      process.exit(run('seed', !!opts.prod));
    });

  db.command('clear')
    .description('Clear all database data')
    .option('--prod', 'Run against the compiled production build')
    .option('-y, --yes', 'Skip the production confirmation prompt')
    .action(async (opts: { prod?: boolean; yes?: boolean }) => {
      if (opts.prod) await confirmDestructive(!!opts.yes);
      process.exit(run('clear', !!opts.prod));
    });

  db.command('reset')
    .description('Clear the database then re-run all seeders')
    .option('--prod', 'Run against the compiled production build')
    .option('-y, --yes', 'Skip the production confirmation prompt')
    .action(async (opts: { prod?: boolean; yes?: boolean }) => {
      if (opts.prod) await confirmDestructive(!!opts.yes);
      const clearStatus = run('clear', !!opts.prod);
      if (clearStatus !== 0) process.exit(clearStatus);
      process.exit(run('seed', !!opts.prod));
    });
}
