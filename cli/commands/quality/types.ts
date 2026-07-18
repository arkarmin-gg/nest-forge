export type FindingLevel = 'fail' | 'warn' | 'review';

export type RuleSeverity = 'high' | 'medium' | 'low';

type RuleStatus = 'implemented' | 'delegated' | 'review-candidate' | 'planned';

type RuleCategory =
  | 'Architecture'
  | 'Database'
  | 'DTO & Query'
  | 'Security'
  | 'Operations & Quality';

export interface QualityRule {
  id: string;
  category: RuleCategory;
  severity: RuleSeverity;
  status: RuleStatus;
  defaultLevel: FindingLevel;
  source: string;
  description: string;
  run?: (context: QualityContext) => Promise<QualityFinding[]>;
}

export interface QualityFinding {
  ruleId: string;
  category: RuleCategory;
  severity: RuleSeverity;
  level: FindingLevel;
  file?: string;
  line?: number;
  column?: number;
  message: string;
  detail?: string;
  fix?: string;
  source: string;
}

export interface QualityScope {
  mode: 'diff' | 'audit';
  base: string;
  files: string[];
}

export interface QualityContext {
  scope: QualityScope;
  allFiles: string[];
  targetFiles: string[];
  selectedRuleId?: string;
  skipBuild: boolean;
}

interface QualitySummary {
  fail: number;
  warn: number;
  review: number;
}

export interface QualityResult {
  schemaVersion: 1;
  status: 'passed' | 'failed' | 'errored';
  scope: QualityScope;
  summary: QualitySummary;
  findings: QualityFinding[];
}

export interface QualityCheckOptions {
  audit?: boolean;
  base: string;
  json?: boolean;
  failOnWarn?: boolean;
  onlyFail?: boolean;
  build?: boolean;
  rule?: string;
}
