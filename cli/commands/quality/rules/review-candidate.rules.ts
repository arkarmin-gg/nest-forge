import { readFileSync } from 'fs';
import * as ts from 'typescript';

import {
  createSourceFile,
  findNodes,
  getDecorators,
  getLineAndColumn,
} from '../ast';
import { QualityRule } from '../types';
import { createFinding, filesForRule, isTypeScriptFile } from './rule-utils';

function countMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

const arch01: QualityRule = {
  id: 'ARCH-01',
  category: 'Architecture',
  severity: 'high',
  status: 'review-candidate',
  defaultLevel: 'review',
  source: 'ARCHITECTURE.md §4 Zone 2 / ADR-0004',
  description:
    'Review @InjectRepository usage in services for cross-module repository injection.',
  async run(context) {
    return filesForRule(context)
      .filter((file) =>
        /^src\/modules\/[^/]+\/services\/.+\.service\.ts$/.test(file),
      )
      .flatMap((file) => {
        const sourceFile = createSourceFile(file);

        return findNodes(sourceFile, ts.isParameter).flatMap((parameter) => {
          const decorators = getDecorators(parameter);
          const injectRepository = decorators.find(
            (decorator) => decorator.name === 'InjectRepository',
          );
          if (!injectRepository) return [];

          const location = getLineAndColumn(
            sourceFile,
            injectRepository.node.getStart(),
          );
          return createFinding(
            arch01,
            'Review repository injection in a domain service.',
            {
              file,
              ...location,
              detail:
                'Confirm this repository belongs to the same module. Cross-module repository access must use the owning module service.',
              fix: 'If the entity is owned by another module, inject that module service from public-api.ts instead.',
            },
          );
        });
      });
  },
};

const arch02: QualityRule = {
  id: 'ARCH-02',
  category: 'Architecture',
  severity: 'high',
  status: 'review-candidate',
  defaultLevel: 'review',
  source: 'ARCHITECTURE.md §4 Zone 1 / §20',
  description:
    'Review controllers for business logic; controllers should call services and return.',
  async run(context) {
    return filesForRule(context)
      .filter((file) => file.startsWith('src/api/'))
      .filter((file) => file.endsWith('.controller.ts'))
      .flatMap((file) => {
        const sourceFile = createSourceFile(file);

        return findNodes(sourceFile, ts.isMethodDeclaration).flatMap(
          (method) => {
            const methodText = method.getText(sourceFile);
            const hasBranching =
              /\b(if|for|while|switch)\s*\(/.test(methodText) ||
              /\?.*:/.test(methodText);
            const hasDataAccess =
              /Repository\b|\.save\s*\(|\.update\s*\(|\.delete\s*\(|\.remove\s*\(|bcrypt(js)?\./.test(
                methodText,
              );

            if (!hasBranching && !hasDataAccess) return [];

            const location = getLineAndColumn(sourceFile, method.getStart());
            return createFinding(
              arch02,
              'Review controller method for logic.',
              {
                file,
                ...location,
                detail: hasDataAccess
                  ? 'Controller method appears to contain persistence/security logic.'
                  : 'Controller method contains branching; confirm it is only response-boundary shaping.',
                fix: 'Move business decisions and persistence work into the owning service.',
              },
            );
          },
        );
      });
  },
};

const std10: QualityRule = {
  id: 'STD-10',
  category: 'Database',
  severity: 'medium',
  status: 'review-candidate',
  defaultLevel: 'review',
  source: 'docs/database-standards.md / ADR-0008',
  description:
    'Review multi-write service operations for @Transactional and txHost usage.',
  async run(context) {
    return filesForRule(context)
      .filter((file) =>
        /^src\/modules\/[^/]+\/services\/.+\.service\.ts$/.test(file),
      )
      .flatMap((file) => {
        const sourceFile = createSourceFile(file);

        return findNodes(sourceFile, ts.isMethodDeclaration).flatMap(
          (method) => {
            const methodText = method.getText(sourceFile);
            const writeCount = countMatches(
              methodText,
              /\.(save|update|delete|remove|softDelete|softRemove)\s*\(/g,
            );
            if (writeCount < 2) return [];

            const hasTransactional = getDecorators(method).some(
              (decorator) => decorator.name === 'Transactional',
            );
            if (hasTransactional) return [];

            const location = getLineAndColumn(sourceFile, method.getStart());
            return createFinding(
              std10,
              'Review multi-write service method for transaction boundary.',
              {
                file,
                ...location,
                detail: `Detected ${writeCount} repository write calls in one method.`,
                fix: 'Wrap true multi-write operations in @Transactional() and route DB access through txHost.',
              },
            );
          },
        );
      });
  },
};

const sec05: QualityRule = {
  id: 'SEC-05',
  category: 'Security',
  severity: 'high',
  status: 'review-candidate',
  defaultLevel: 'review',
  source: 'docs/security-standards.md / ADR-0006',
  description:
    'Review @Public endpoints and audience-zone guards for correct authentication and authorization.',
  async run(context) {
    return filesForRule(context)
      .filter((file) => file.startsWith('src/api/v1/'))
      .filter((file) => file.endsWith('.controller.ts'))
      .flatMap((file) => {
        const sourceFile = createSourceFile(file);
        const findings = [];

        for (const method of findNodes(sourceFile, ts.isMethodDeclaration)) {
          const decorators = getDecorators(method);
          const isPublic = decorators.some(
            (decorator) => decorator.name === 'Public',
          );
          if (!isPublic) continue;

          const location = getLineAndColumn(sourceFile, method.getStart());
          findings.push(
            createFinding(sec05, 'Review public endpoint justification.', {
              file,
              ...location,
              detail:
                '@Public() is an auth opt-out. Confirm this is an allowed pre-auth or health/readiness flow.',
              fix: 'Remove @Public() or document the accepted pre-auth reason.',
            }),
          );
        }

        const content = sourceFile.getText();
        if (
          file.startsWith('src/api/v1/app/') &&
          !content.includes('SubjectGuard')
        ) {
          findings.push(
            createFinding(
              sec05,
              'App controller may be missing SubjectGuard.',
              {
                file,
                detail:
                  'App-zone endpoints should use SubjectGuard and @RequireSubject(SubjectType.USER).',
                fix: 'Add SubjectGuard and @RequireSubject(SubjectType.USER) at controller or route level.',
              },
            ),
          );
        }

        if (
          file.startsWith('src/api/v1/admin/') &&
          !content.includes('PermissionsGuard')
        ) {
          findings.push(
            createFinding(
              sec05,
              'Admin controller may be missing PermissionsGuard.',
              {
                file,
                detail:
                  'Admin-zone endpoints should use PermissionsGuard and @RequirePermissions(...).',
                fix: 'Add PermissionsGuard and @RequirePermissions(...) at controller or route level.',
              },
            ),
          );
        }

        return findings;
      });
  },
};

const std15: QualityRule = {
  id: 'STD-15',
  category: 'Operations & Quality',
  severity: 'medium',
  status: 'review-candidate',
  defaultLevel: 'review',
  source: 'ARCHITECTURE.md §20',
  description:
    'Review cache-backed services for write-path invalidation or overwrite.',
  async run(context) {
    return filesForRule(context)
      .filter((file) =>
        /^src\/modules\/[^/]+\/services\/.+\.service\.ts$/.test(file),
      )
      .filter(isTypeScriptFile)
      .flatMap((file) => {
        const content = readFileSync(file, 'utf8');
        if (!/cacheManager\.(get|set)/.test(content)) return [];
        if (/cacheManager\.(del|set)/.test(content)) return [];

        return createFinding(
          std15,
          'Cache-backed service may be missing invalidation.',
          {
            file,
            detail:
              'This service reads from cache but no cacheManager.del or cache overwrite was found.',
            fix: 'Invalidate or overwrite cache entries in corresponding write paths.',
          },
        );
      });
  },
};

export const REVIEW_CANDIDATE_RULES: QualityRule[] = [
  arch01,
  arch02,
  std10,
  sec05,
  std15,
];
