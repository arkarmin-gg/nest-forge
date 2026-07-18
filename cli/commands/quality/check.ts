import {
  findNewBaselineEntries,
  normalizeToolOutput,
  readQualityBaseline,
} from './baseline';
import { QUALITY_RULES } from './rules';
import { createSummary } from './reporter';
import { listTrackedFiles, resolveQualityScope } from './scope';
import { applySuppressions } from './suppressions';
import { runNpmScript } from './subprocess';
import {
  QualityCheckOptions,
  QualityContext,
  QualityFinding,
  QualityResult,
} from './types';

function selectRules(ruleId?: string) {
  if (!ruleId) return QUALITY_RULES;

  const rule = QUALITY_RULES.find((candidate) => candidate.id === ruleId);
  if (!rule) {
    throw new Error(`Unknown quality rule: ${ruleId}`);
  }

  return [rule];
}

function createStd16Finding(
  message: string,
  detail: string,
  fix?: string,
): QualityFinding {
  return {
    ruleId: 'STD-16',
    category: 'Operations & Quality',
    severity: 'high',
    level: 'fail',
    message,
    detail,
    fix,
    source: 'ARCHITECTURE.md §23',
  };
}

function shouldRunStd16(ruleId?: string): boolean {
  return !ruleId || ruleId === 'STD-16';
}

function createReviewCandidateFinding(rule: {
  id: string;
  category: QualityFinding['category'];
  severity: QualityFinding['severity'];
  defaultLevel: QualityFinding['level'];
  description: string;
  source: string;
}): QualityFinding {
  return {
    ruleId: rule.id,
    category: rule.category,
    severity: rule.severity,
    level: rule.defaultLevel,
    message: rule.description,
    detail:
      'This rule needs human judgment or a future detector; review the scoped files manually.',
    source: rule.source,
  };
}

function runStd16Gates(skipBuild: boolean): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const scriptNames = ['lint:check', 'typecheck'];
  if (!skipBuild) scriptNames.push('build');

  for (const scriptName of scriptNames) {
    const result = runNpmScript(scriptName);
    if (result.status === 0) continue;

    findings.push(
      createStd16Finding(
        `${scriptName} failed.`,
        result.output ||
          `${result.command} exited with status ${result.status}.`,
        `Run npm run ${scriptName} locally and fix the reported issues.`,
      ),
    );
  }

  const knip = runNpmScript('knip');
  if (knip.status !== 0) {
    const currentEntries = normalizeToolOutput(knip.output);
    const baseline = readQualityBaseline();
    const newEntries = findNewBaselineEntries(currentEntries, baseline.knip);

    if (newEntries.length > 0) {
      findings.push(
        createStd16Finding(
          'knip introduced new findings.',
          newEntries.join('\n'),
          'Remove unused code or update .forge-quality-baseline.json intentionally with forge quality baseline update.',
        ),
      );
    }
  }

  return findings;
}

export async function runQualityCheck(
  options: QualityCheckOptions,
): Promise<QualityResult> {
  const scope = resolveQualityScope(!!options.audit, options.base);
  const rules = selectRules(options.rule);
  const context: QualityContext = {
    scope,
    allFiles: listTrackedFiles(),
    targetFiles: scope.files,
    selectedRuleId: options.rule,
    skipBuild: options.build === false,
  };

  const findings: QualityFinding[] = [];

  if (shouldRunStd16(options.rule)) {
    findings.push(...runStd16Gates(context.skipBuild));
  }

  for (const rule of rules) {
    if (rule.status === 'review-candidate' && !rule.run) {
      findings.push(createReviewCandidateFinding(rule));
      continue;
    }

    if (!rule.run) continue;
    findings.push(...(await rule.run(context)));
  }

  const finalFindings = applySuppressions(context, QUALITY_RULES, findings);
  const summary = createSummary(finalFindings);
  const failed = summary.fail > 0 || (!!options.failOnWarn && summary.warn > 0);

  return {
    schemaVersion: 1,
    status: failed ? 'failed' : 'passed',
    scope,
    summary,
    findings: finalFindings,
  };
}
