import { existsSync } from 'fs';
import * as readline from 'readline';

export function requireBuild(path: string): void {
  if (!existsSync(path)) {
    console.error(`${path} not found — run \`npm run build\` first.`);
    process.exit(1);
  }
}

export async function confirmDestructive(skip: boolean): Promise<void> {
  if (skip) return;

  const host = process.env.DB_HOST ?? '(unset)';
  const name = process.env.DB_NAME ?? '(unset)';

  console.log('This will run against the PRODUCTION database:');
  console.log(`  host: ${host}`);
  console.log(`  database: ${name}`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question('Type "yes" to continue: ', resolve);
  });
  rl.close();

  if (answer.trim().toLowerCase() !== 'yes') {
    console.error('Aborted.');
    process.exit(1);
  }
}
