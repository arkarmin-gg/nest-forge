import { statSync } from 'fs';

import {
  FindingLevel,
  QualityContext,
  QualityFinding,
  QualityRule,
} from '../types';

export function isTypeScriptFile(file: string): boolean {
  return file.endsWith('.ts') && !file.endsWith('.d.ts');
}

function fileExists(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

export function filesForRule(context: QualityContext): string[] {
  const files =
    context.scope.mode === 'audit' ? context.allFiles : context.targetFiles;
  return files.filter(fileExists);
}

export function createFinding(
  rule: QualityRule,
  message: string,
  options: {
    file?: string;
    line?: number;
    column?: number;
    level?: FindingLevel;
    detail?: string;
    fix?: string;
  } = {},
): QualityFinding {
  return {
    ruleId: rule.id,
    category: rule.category,
    severity: rule.severity,
    level: options.level ?? rule.defaultLevel,
    file: options.file,
    line: options.line,
    column: options.column,
    message,
    detail: options.detail,
    fix: options.fix,
    source: rule.source,
  };
}
