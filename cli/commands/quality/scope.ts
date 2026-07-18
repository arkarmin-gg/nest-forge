import { spawnSync } from 'child_process';

import { QualityScope } from './types';

function runGit(args: string[]): string[] {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const reason = result.stderr.trim() || result.stdout.trim();
    throw new Error(`git ${args.join(' ')} failed: ${reason}`);
  }

  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function listTrackedFiles(): string[] {
  return runGit(['ls-files']);
}

export function resolveQualityScope(
  audit: boolean,
  base: string,
): QualityScope {
  if (audit) {
    return {
      mode: 'audit',
      base,
      files: listTrackedFiles(),
    };
  }

  return {
    mode: 'diff',
    base,
    files: runGit(['diff', '--name-only', `${base}...HEAD`]),
  };
}
