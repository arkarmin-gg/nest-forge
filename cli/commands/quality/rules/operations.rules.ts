import { readFileSync } from 'fs';

import { QualityRule } from '../types';
import { createFinding, filesForRule, isTypeScriptFile } from './rule-utils';

const std05: QualityRule = {
  id: 'STD-05',
  category: 'Operations & Quality',
  severity: 'low',
  status: 'implemented',
  defaultLevel: 'fail',
  source: 'ARCHITECTURE.md §20 / §23',
  description:
    'Application code avoids console.log, console.debug, and console.info outside seeders and tests.',
  async run(context) {
    return filesForRule(context)
      .filter((file) => file.startsWith('src/'))
      .filter(isTypeScriptFile)
      .filter((file) => !file.includes('/seeders/'))
      .filter((file) => !file.endsWith('.spec.ts'))
      .flatMap((file) => {
        const lines = readFileSync(file, 'utf8').split('\n');

        return lines.flatMap((line, index) => {
          const column = line.search(/console\.(log|debug|info)\b/);
          if (column === -1) return [];

          return createFinding(
            std05,
            'console.log/debug/info found in application code.',
            {
              file,
              line: index + 1,
              column: column + 1,
              fix: 'Use Logger from @nestjs/common.',
            },
          );
        });
      });
  },
};

const std08: QualityRule = {
  id: 'STD-08',
  category: 'Database',
  severity: 'high',
  status: 'implemented',
  defaultLevel: 'fail',
  source: 'docs/database-standards.md / ADR-0012',
  description: 'TypeORM synchronize: true is never enabled.',
  async run(context) {
    return filesForRule(context)
      .filter((file) => file.startsWith('src/'))
      .filter(isTypeScriptFile)
      .flatMap((file) => {
        const lines = readFileSync(file, 'utf8').split('\n');

        return lines.flatMap((line, index) => {
          const column = line.search(/synchronize:\s*true\b/);
          if (column === -1) return [];

          return createFinding(std08, 'TypeORM synchronize: true found.', {
            file,
            line: index + 1,
            column: column + 1,
            fix: 'Disable synchronize and use migrations for schema changes.',
          });
        });
      });
  },
};

export const OPERATIONS_RULES: QualityRule[] = [std05, std08];
