import { existsSync, readFileSync, writeFileSync } from 'fs';

const BASELINE_PATH = '.forge-quality-baseline.json';

interface QualityBaseline {
  schemaVersion: 1;
  knip: string[];
}

function normalizeLine(line: string): string {
  return line.trim().replace(/\s+/g, ' ');
}

export function normalizeToolOutput(output: string): string[] {
  return output
    .split('\n')
    .map(normalizeLine)
    .filter(Boolean)
    .filter((line) => !line.startsWith('> nest-forge@'))
    .filter((line) => line !== '> knip')
    .sort((a, b) => a.localeCompare(b));
}

export function readQualityBaseline(): QualityBaseline {
  if (!existsSync(BASELINE_PATH)) {
    return {
      schemaVersion: 1,
      knip: [],
    };
  }

  const parsed = JSON.parse(
    readFileSync(BASELINE_PATH, 'utf8'),
  ) as Partial<QualityBaseline>;

  return {
    schemaVersion: 1,
    knip: Array.isArray(parsed.knip) ? parsed.knip : [],
  };
}

export function findNewBaselineEntries(
  currentEntries: string[],
  baselineEntries: string[],
): string[] {
  const baseline = new Set(baselineEntries);
  return currentEntries.filter((entry) => !baseline.has(entry));
}

export function writeQualityBaseline(knipEntries: string[]): void {
  const baseline: QualityBaseline = {
    schemaVersion: 1,
    knip: [...new Set(knipEntries)].sort((a, b) => a.localeCompare(b)),
  };

  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
}
