import { spawnSync } from 'child_process';

export interface SubprocessResult {
  command: string;
  status: number;
  output: string;
}

function normalizeStatus(status: number | null): number {
  return status ?? 2;
}

function runSubprocess(command: string, args: string[]): SubprocessResult {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1024 * 1024 * 20,
  });

  return {
    command: [command, ...args].join(' '),
    status: normalizeStatus(result.status),
    output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
  };
}

export function runNpmScript(script: string): SubprocessResult {
  return runSubprocess('npm', ['run', script]);
}
