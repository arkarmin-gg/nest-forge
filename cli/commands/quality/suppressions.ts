import { readFileSync } from 'fs';

import { filesForRule } from './rules/rule-utils';
import {
  FindingLevel,
  QualityContext,
  QualityFinding,
  QualityRule,
} from './types';

interface Suppression {
  file: string;
  line: number;
  kind: 'next-line' | 'file';
  ruleIds: string[];
  reason: string;
  used: boolean;
}

const SUPPRESSION_RULE: QualityRule = {
  id: 'FQ-01',
  category: 'Operations & Quality',
  severity: 'medium',
  status: 'implemented',
  defaultLevel: 'fail',
  source: 'docs/review/ARCHITECTURE-COMPLIANCE.md',
  description:
    'Forge quality suppressions must name rule IDs, include reasons, and be used.',
};

function createSuppressionFinding(
  file: string,
  line: number,
  message: string,
  detail?: string,
): QualityFinding {
  return {
    ruleId: SUPPRESSION_RULE.id,
    category: SUPPRESSION_RULE.category,
    severity: SUPPRESSION_RULE.severity,
    level: SUPPRESSION_RULE.defaultLevel,
    file,
    line,
    message,
    detail,
    source: SUPPRESSION_RULE.source,
  };
}

function parseRuleIds(rawRuleIds: string): string[] {
  return rawRuleIds
    .split(/[,\s]+/)
    .map((ruleId) => ruleId.trim())
    .filter(Boolean);
}

function parseSuppressionLine(
  file: string,
  lineText: string,
  line: number,
  validRuleIds: Set<string>,
): { suppression?: Suppression; finding?: QualityFinding } | undefined {
  if (!lineText.includes('forge-quality-disable')) return undefined;

  const match =
    /forge-quality-disable-(next-line|file)\s+(.+?)\s+--\s+(.+)$/.exec(
      lineText,
    );

  if (!match) {
    return {
      finding: createSuppressionFinding(
        file,
        line,
        'Invalid forge quality suppression.',
        'Use forge-quality-disable-next-line RULE-ID -- reason.',
      ),
    };
  }

  const [, kind, rawRuleIds, rawReason] = match;
  const ruleIds = parseRuleIds(rawRuleIds);
  const unknownRuleIds = ruleIds.filter((ruleId) => !validRuleIds.has(ruleId));
  const reason = rawReason.trim();

  if (
    ruleIds.length === 0 ||
    unknownRuleIds.length > 0 ||
    reason.length === 0
  ) {
    return {
      finding: createSuppressionFinding(
        file,
        line,
        'Invalid forge quality suppression.',
        unknownRuleIds.length > 0
          ? `Unknown rule IDs: ${unknownRuleIds.join(', ')}`
          : 'Suppression must name at least one rule and include a reason.',
      ),
    };
  }

  return {
    suppression: {
      file,
      line,
      kind: kind === 'file' ? 'file' : 'next-line',
      ruleIds,
      reason,
      used: false,
    },
  };
}

function collectSuppressions(
  context: QualityContext,
  validRuleIds: Set<string>,
): {
  suppressions: Suppression[];
  findings: QualityFinding[];
} {
  const suppressions: Suppression[] = [];
  const findings: QualityFinding[] = [];

  for (const file of filesForRule(context)) {
    const lines = readFileSync(file, 'utf8').split('\n');

    lines.forEach((lineText, index) => {
      const parsed = parseSuppressionLine(
        file,
        lineText,
        index + 1,
        validRuleIds,
      );

      if (parsed?.suppression) suppressions.push(parsed.suppression);
      if (parsed?.finding) findings.push(parsed.finding);
    });
  }

  return { suppressions, findings };
}

function suppressesFinding(
  suppression: Suppression,
  finding: QualityFinding,
): boolean {
  if (suppression.file !== finding.file) return false;
  if (!suppression.ruleIds.includes(finding.ruleId)) return false;
  if (suppression.kind === 'file') return true;

  return finding.line === suppression.line + 1;
}

export function applySuppressions(
  context: QualityContext,
  validRules: QualityRule[],
  findings: QualityFinding[],
): QualityFinding[] {
  const validRuleIds = new Set(validRules.map((rule) => rule.id));
  validRuleIds.add(SUPPRESSION_RULE.id);

  const parsed = collectSuppressions(context, validRuleIds);
  const unsuppressedFindings = findings.filter((finding) => {
    const suppression = parsed.suppressions.find((candidate) =>
      suppressesFinding(candidate, finding),
    );

    if (!suppression) return true;
    suppression.used = true;
    return false;
  });

  const unusedSuppressions = parsed.suppressions
    .filter((suppression) => !suppression.used)
    .map((suppression) =>
      createSuppressionFinding(
        suppression.file,
        suppression.line,
        'Unused forge quality suppression.',
        `Suppression for ${suppression.ruleIds.join(', ')} did not match a finding.`,
      ),
    );

  return [...unsuppressedFindings, ...parsed.findings, ...unusedSuppressions];
}

export { SUPPRESSION_RULE };
