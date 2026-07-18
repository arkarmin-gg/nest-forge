import { QualityFinding, QualityResult, RuleSeverity } from './types';

const SEVERITY_ORDER: RuleSeverity[] = ['high', 'medium', 'low'];

function formatLocation(finding: QualityFinding): string {
  if (!finding.file) return '';

  const line = finding.line ? `:${finding.line}` : '';
  const column = finding.column ? `:${finding.column}` : '';
  return ` ${finding.file}${line}${column}`;
}

function printFinding(finding: QualityFinding): void {
  console.log(
    `  ${finding.level.toUpperCase()} ${finding.ruleId}${formatLocation(
      finding,
    )}`,
  );
  console.log(`    ${finding.message}`);

  if (finding.detail) console.log(`    detail: ${finding.detail}`);
  if (finding.fix) console.log(`    fix: ${finding.fix}`);
}

export function createSummary(findings: QualityFinding[]) {
  return findings.reduce(
    (summary, finding) => {
      summary[finding.level] += 1;
      return summary;
    },
    { fail: 0, warn: 0, review: 0 },
  );
}

export function filterResultToFailures(result: QualityResult): QualityResult {
  const findings = result.findings.filter(
    (finding) => finding.level === 'fail',
  );

  return {
    ...result,
    findings,
    summary: createSummary(findings),
  };
}

export function printHumanReport(result: QualityResult): void {
  console.log('Forge Quality');
  console.log('');
  const scopeLabel =
    result.scope.mode === 'audit'
      ? 'audit'
      : `diff ${result.scope.base}...HEAD`;
  console.log(`Scope: ${scopeLabel}`);
  console.log(`Files: ${result.scope.files.length}`);
  console.log(`Result: ${result.status}`);

  if (result.findings.length === 0) {
    console.log('');
    console.log('No findings.');
    return;
  }

  for (const severity of SEVERITY_ORDER) {
    const findings = result.findings.filter(
      (finding) => finding.severity === severity,
    );
    if (findings.length === 0) continue;

    console.log('');
    console.log(severity[0].toUpperCase() + severity.slice(1));
    findings.forEach(printFinding);
  }

  console.log('');
  console.log(
    `Summary: ${result.summary.fail} fail, ${result.summary.warn} warn, ${result.summary.review} review`,
  );
}
