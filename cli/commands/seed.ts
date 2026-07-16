import { Command } from 'commander';
import { spawnSync } from 'child_process';

function runScript(script: string): number {
  const result = spawnSync(
    'ts-node',
    ['-r', 'tsconfig-paths/register', script],
    { stdio: 'inherit', shell: true },
  );
  return result.status ?? 0;
}

export function registerSeedCommands(db: Command): void {
  db.command('seed')
    .description('Run all database seeders')
    .action(() => {
      process.exit(runScript('src/seeders/seed.ts'));
    });

  db.command('clear')
    .description('Clear all database data')
    .action(() => {
      process.exit(runScript('src/seeders/clear.ts'));
    });

  db.command('reset')
    .description('Clear the database then re-run all seeders')
    .action(() => {
      const clearStatus = runScript('src/seeders/clear.ts');
      if (clearStatus !== 0) process.exit(clearStatus);
      process.exit(runScript('src/seeders/seed.ts'));
    });
}
