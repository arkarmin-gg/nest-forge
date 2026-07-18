import { Command } from 'commander';
import { normalizeToolOutput, writeQualityBaseline } from './baseline';
import { runQualityCheck } from './check';
import { filterResultToFailures, printHumanReport } from './reporter';
import { QUALITY_RULES } from './rules';
import { runNpmScript } from './subprocess';
import { QualityCheckOptions } from './types';

function printRules(): void {
  const rows = QUALITY_RULES.map((rule) => ({
    id: rule.id,
    status: rule.status,
    severity: rule.severity,
    level: rule.defaultLevel,
    category: rule.category,
    source: rule.source,
  }));

  console.table(rows);
}

function isOnlyFailRequested(options: QualityCheckOptions): boolean {
  return (
    options.onlyFail === true || process.env.npm_config_only_fail === 'true'
  );
}

export function registerQualityCommand(program: Command): void {
  const quality = program
    .command('quality')
    .description('Quality gate and architecture compliance checks');

  quality
    .command('rules')
    .description('List quality rule IDs, severities, categories, and sources')
    .action(() => {
      printRules();
    });

  quality
    .command('baseline')
    .description('Manage quality baselines')
    .command('update')
    .description('Refresh baseline-backed quality findings')
    .action(() => {
      const knip = runNpmScript('knip');
      const entries = normalizeToolOutput(knip.output);

      writeQualityBaseline(entries);
      console.log(
        `Wrote .forge-quality-baseline.json with ${entries.length} knip entries.`,
      );
      process.exit(0);
    });

  quality
    .command('check')
    .description('Run quality checks')
    .option('--audit', 'Check the full project instead of changed files')
    .option('--base <ref>', 'Base ref for diff mode', 'main')
    .option('--json', 'Print stable JSON output')
    .option('--fail-on-warn', 'Fail when warning findings are present')
    .option('--only-fail', 'Only list failed findings')
    .option('--no-build', 'Skip the build subprocess gate')
    .option('--rule <id>', 'Run only one rule ID')
    .action(async (opts: QualityCheckOptions) => {
      try {
        const result = await runQualityCheck(opts);
        const report = isOnlyFailRequested(opts)
          ? filterResultToFailures(result)
          : result;

        if (opts.json) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          printHumanReport(report);
        }

        process.exit(result.status === 'failed' ? 1 : 0);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unknown quality check error';

        if (opts.json) {
          console.log(
            JSON.stringify(
              {
                schemaVersion: 1,
                status: 'errored',
                error: message,
              },
              null,
              2,
            ),
          );
        } else {
          console.error(message);
        }

        process.exit(2);
      }
    });
}
