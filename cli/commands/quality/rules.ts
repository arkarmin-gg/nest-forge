import { QualityRule } from './types';
import { ARCHITECTURE_RULES } from './rules/architecture.rules';
import { DATABASE_RULES } from './rules/database.rules';
import { OPERATIONS_RULES } from './rules/operations.rules';
import { REVIEW_CANDIDATE_RULES } from './rules/review-candidate.rules';
import { SECURITY_RULES } from './rules/security.rules';
import { SUPPRESSION_RULE } from './suppressions';

const SEMANTIC_RULES: QualityRule[] = [
  {
    id: 'ARCH-03',
    category: 'Architecture',
    severity: 'high',
    status: 'delegated',
    defaultLevel: 'fail',
    source: 'ARCHITECTURE.md §5 / ADR-0013',
    description:
      "Controller deep imports and wrong module barrels are delegated to ESLint's no-restricted-imports rule.",
  },
  {
    id: 'ARCH-08',
    category: 'Architecture',
    severity: 'medium',
    status: 'delegated',
    defaultLevel: 'fail',
    source: 'ARCHITECTURE.md §5 / §21',
    description:
      "Circular import detection is delegated to ESLint's import-x/no-cycle rule.",
  },
  {
    id: 'STD-16',
    category: 'Operations & Quality',
    severity: 'high',
    status: 'delegated',
    defaultLevel: 'fail',
    source: 'ARCHITECTURE.md §23',
    description:
      'ESLint, typecheck, build, and knip introduce no new errors or findings.',
  },
  {
    id: 'ARCH-04',
    category: 'Architecture',
    severity: 'medium',
    status: 'planned',
    defaultLevel: 'review',
    source: 'ARCHITECTURE.md §5 / ADR-0013',
    description:
      'Domain services import services from public-api.ts and entities/events from index.ts when that barrel exists.',
  },
  {
    id: 'ARCH-06',
    category: 'Architecture',
    severity: 'high',
    status: 'planned',
    defaultLevel: 'review',
    source: 'ARCHITECTURE.md §4 / §7 / ADR-0006',
    description:
      'App-zone endpoints use whitelist response DTO mapping and derive targets from @CurrentUser().',
  },
  {
    id: 'ARCH-07',
    category: 'Architecture',
    severity: 'medium',
    status: 'planned',
    defaultLevel: 'review',
    source: 'ARCHITECTURE.md §8 / ADR-0006',
    description:
      'Audience-restricted endpoints use SubjectGuard and RequireSubject.',
  },
  {
    id: 'STD-01',
    category: 'Database',
    severity: 'medium',
    status: 'planned',
    defaultLevel: 'review',
    source: 'docs/database-standards.md',
    description:
      'Entities use sanctioned base classes with documented exceptions only.',
  },
  {
    id: 'STD-03',
    category: 'Database',
    severity: 'medium',
    status: 'planned',
    defaultLevel: 'review',
    source: 'docs/database-standards.md',
    description:
      'Soft-deletable domain records use soft delete instead of physical delete.',
  },
  {
    id: 'STD-06',
    category: 'Operations & Quality',
    severity: 'low',
    status: 'planned',
    defaultLevel: 'review',
    source: 'ARCHITECTURE.md §20',
    description:
      'Injected dependencies are readonly and service methods have explicit return types.',
  },
  {
    id: 'STD-07',
    category: 'DTO & Query',
    severity: 'medium',
    status: 'planned',
    defaultLevel: 'review',
    source: 'ARCHITECTURE.md §14 / ADR-0010',
    description:
      'Update DTOs use PartialType and list/filter DTOs use shared pagination/sort bases.',
  },
  {
    id: 'STD-09',
    category: 'Operations & Quality',
    severity: 'medium',
    status: 'planned',
    defaultLevel: 'review',
    source: 'ARCHITECTURE.md §11 / §21',
    description:
      '@LogActivity is only used on authenticated endpoints; public endpoints log from services.',
  },
  {
    id: 'SEC-03',
    category: 'Security',
    severity: 'medium',
    status: 'planned',
    defaultLevel: 'review',
    source: 'ARCHITECTURE.md §13 / §20',
    description:
      'Emails are queued through NotificationService and not sent inline from request paths.',
  },
  {
    id: 'SEC-04',
    category: 'Security',
    severity: 'medium',
    status: 'planned',
    defaultLevel: 'review',
    source: 'docs/security-standards.md',
    description:
      'Database stores S3 keys, not presigned URLs; responses resolve URLs at the boundary.',
  },
  {
    id: 'SEC-09',
    category: 'DTO & Query',
    severity: 'medium',
    status: 'planned',
    defaultLevel: 'review',
    source: 'docs/security-standards.md / ADR-0010',
    description:
      'Controllers avoid raw unvalidated body/query/params and allowlist dynamic query fields.',
  },
];

export const QUALITY_RULES: QualityRule[] = [
  SUPPRESSION_RULE,
  ...ARCHITECTURE_RULES,
  ...DATABASE_RULES,
  ...OPERATIONS_RULES,
  ...SECURITY_RULES,
  ...REVIEW_CANDIDATE_RULES,
  ...SEMANTIC_RULES,
];
