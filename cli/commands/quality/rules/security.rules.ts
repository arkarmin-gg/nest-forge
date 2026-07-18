import { readFileSync } from 'fs';
import * as ts from 'typescript';

import {
  createSourceFile,
  findNodes,
  getDecorators,
  getLineAndColumn,
  getObjectLiteralProperty,
  getPropertyName,
  objectLiteralHasProperty,
} from '../ast';
import { QualityRule } from '../types';
import { createFinding, filesForRule, isTypeScriptFile } from './rule-utils';

const SENSITIVE_FIELD_PATTERN =
  /(password|token|otp|secret|apiKey|api_key|authorization|cookie|credential|accessKey|access_key|privateKey|private_key)/i;

function objectLiteralHasSelectFalse(
  objectLiteral: ts.ObjectLiteralExpression,
): boolean {
  const select = getObjectLiteralProperty(objectLiteral, 'select');
  return select?.kind === ts.SyntaxKind.FalseKeyword;
}

function propertyDecorators(sourceFile: ts.SourceFile) {
  return findNodes(sourceFile, ts.isPropertyDeclaration).map((property) => ({
    property,
    decorators: getDecorators(property),
  }));
}

const std04: QualityRule = {
  id: 'STD-04',
  category: 'Security',
  severity: 'high',
  status: 'implemented',
  defaultLevel: 'fail',
  source: 'docs/security-standards.md',
  description: 'Sensitive columns carry @Exclude() and select: false.',
  async run(context) {
    return filesForRule(context)
      .filter((file) => file.startsWith('src/modules/'))
      .filter((file) => file.endsWith('.entity.ts'))
      .flatMap((file) => {
        const sourceFile = createSourceFile(file);

        return propertyDecorators(sourceFile).flatMap(
          ({ property, decorators }) => {
            const propertyName = getPropertyName(property.name);
            if (!propertyName || !SENSITIVE_FIELD_PATTERN.test(propertyName)) {
              return [];
            }

            const columnDecorator = decorators.find(
              (decorator) => decorator.name === 'Column',
            );
            if (!columnDecorator) return [];

            const hasExclude = decorators.some(
              (decorator) => decorator.name === 'Exclude',
            );
            const hasSelectFalse = columnDecorator.arguments
              .filter(ts.isObjectLiteralExpression)
              .some(objectLiteralHasSelectFalse);

            if (hasExclude && hasSelectFalse) return [];

            const location = getLineAndColumn(sourceFile, property.getStart());
            return createFinding(
              std04,
              'Sensitive entity column is missing @Exclude() or select: false.',
              {
                file,
                ...location,
                detail: `${propertyName} should not be serialized or selected by default.`,
                fix: 'Add @Exclude() and @Column({ select: false }) to sensitive fields.',
              },
            );
          },
        );
      });
  },
};

const sec01: QualityRule = {
  id: 'SEC-01',
  category: 'Security',
  severity: 'high',
  status: 'implemented',
  defaultLevel: 'fail',
  source: 'docs/security-standards.md',
  description:
    'Passwords are hashed through PasswordHashUtil, never raw bcrypt calls in services.',
  async run(context) {
    return filesForRule(context)
      .filter((file) => file.startsWith('src/modules/'))
      .filter((file) => file.endsWith('.service.ts'))
      .flatMap((file) => {
        const lines = readFileSync(file, 'utf8').split('\n');

        return lines.flatMap((line, index) => {
          const column = line.search(/\bbcrypt(js)?\.(hash|compare)\b/);
          if (column === -1) return [];

          return createFinding(sec01, 'Raw bcrypt call found in a service.', {
            file,
            line: index + 1,
            column: column + 1,
            fix: 'Use PasswordHashUtil instead of direct bcrypt/bcryptjs calls.',
          });
        });
      });
  },
};

const sec02: QualityRule = {
  id: 'SEC-02',
  category: 'Security',
  severity: 'high',
  status: 'implemented',
  defaultLevel: 'warn',
  source: 'docs/security-standards.md',
  description:
    'Review logger calls that appear to mention passwords, tokens, OTPs, secrets, authorization, or cookies.',
  async run(context) {
    return filesForRule(context)
      .filter((file) => file.startsWith('src/'))
      .filter(isTypeScriptFile)
      .flatMap((file) => {
        const sourceFile = createSourceFile(file);

        return findNodes(sourceFile, ts.isCallExpression).flatMap((node) => {
          if (!ts.isPropertyAccessExpression(node.expression)) return [];

          const receiver = node.expression.expression.getText(sourceFile);
          const method = node.expression.name.text;
          const isLoggerCall =
            receiver.endsWith('logger') ||
            receiver.endsWith('Logger') ||
            receiver === 'logger' ||
            receiver === 'Logger';
          const isLogMethod = /^(log|warn|error|debug|verbose)$/.test(method);
          if (!isLoggerCall || !isLogMethod) return [];

          const sensitiveArgument = node.arguments.find((argument) => {
            if (
              ts.isStringLiteral(argument) ||
              ts.isNoSubstitutionTemplateLiteral(argument)
            ) {
              return false;
            }

            if (ts.isTemplateExpression(argument)) {
              return argument.templateSpans.some((span) =>
                SENSITIVE_FIELD_PATTERN.test(
                  span.expression.getText(sourceFile),
                ),
              );
            }

            return SENSITIVE_FIELD_PATTERN.test(argument.getText(sourceFile));
          });

          if (!sensitiveArgument) return [];

          const location = getLineAndColumn(sourceFile, node.getStart());
          return createFinding(
            sec02,
            'Logger call appears to include a sensitive value.',
            {
              file,
              ...location,
              level: 'warn',
              detail: sensitiveArgument.getText(sourceFile),
              fix: 'Log request IDs and safe context only; redact sensitive values.',
            },
          );
        });
      });
  },
};

const sec06: QualityRule = {
  id: 'SEC-06',
  category: 'Security',
  severity: 'medium',
  status: 'implemented',
  defaultLevel: 'review',
  source: 'docs/security-standards.md',
  description:
    'Public auth/provider routes that consume credentials, OTPs, refresh tokens, registration sessions, reset tokens, or provider calls have route-level throttling.',
  async run(context) {
    return filesForRule(context)
      .filter((file) => file === 'src/api/v1/auth/auth.controller.ts')
      .flatMap((file) => {
        const sourceFile = createSourceFile(file);

        return findNodes(sourceFile, ts.isMethodDeclaration).flatMap(
          (method) => {
            const decorators = getDecorators(method);
            const isPublic = decorators.some(
              (decorator) => decorator.name === 'Public',
            );
            const hasThrottle = decorators.some(
              (decorator) => decorator.name === 'Throttle',
            );
            if (!isPublic || hasThrottle) return [];

            const location = getLineAndColumn(sourceFile, method.getStart());
            return createFinding(
              sec06,
              'Public auth route is missing route-level throttling.',
              {
                file,
                ...location,
                level: 'review',
                fix: 'Add @Throttle(...) or document why this public auth route is exempt.',
              },
            );
          },
        );
      });
  },
};

const sec07: QualityRule = {
  id: 'SEC-07',
  category: 'Security',
  severity: 'high',
  status: 'implemented',
  defaultLevel: 'fail',
  source: 'docs/security-standards.md',
  description: 'Audit diffs and logs redact sensitive key variants.',
  async run(context) {
    return filesForRule(context)
      .filter(
        (file) => file === 'src/modules/log/utils/audit-log-metadata.util.ts',
      )
      .flatMap((file) => {
        const content = readFileSync(file, 'utf8');
        const requiredPatterns = [
          'password',
          'token',
          'otp',
          'secret',
          'api',
          'authorization',
          'cookie',
          'credential',
        ];

        return requiredPatterns.flatMap((pattern) => {
          if (content.toLowerCase().includes(pattern)) return [];

          return createFinding(
            sec07,
            `Audit redaction patterns do not mention ${pattern}.`,
            {
              file,
              fix: 'Keep sensitive audit redaction patterns aligned with docs/security-standards.md.',
            },
          );
        });
      });
  },
};

const sec08: QualityRule = {
  id: 'SEC-08',
  category: 'Security',
  severity: 'high',
  status: 'implemented',
  defaultLevel: 'warn',
  source: 'docs/security-standards.md / ADR-0014',
  description:
    'New config values have no production defaults and provider toggles fail closed.',
  async run(context) {
    return filesForRule(context)
      .filter((file) => file === 'src/common/config/env.validation.ts')
      .flatMap((file) => {
        const sourceFile = createSourceFile(file);

        return findNodes(sourceFile, ts.isCallExpression).flatMap((node) => {
          if (!ts.isPropertyAccessExpression(node.expression)) return [];
          if (node.expression.name.text !== 'default') return [];

          const targetText = node.expression.expression.getText(sourceFile);
          const argumentText = node.arguments[0]?.getText(sourceFile) ?? '';
          const looksSensitive = SENSITIVE_FIELD_PATTERN.test(targetText);
          const placeholderSecret = /secret|password|token|api/i.test(
            argumentText,
          );

          if (!looksSensitive && !placeholderSecret) return [];

          const location = getLineAndColumn(sourceFile, node.getStart());
          return createFinding(
            sec08,
            'Sensitive-looking config value has a default.',
            {
              file,
              ...location,
              level: 'warn',
              detail: node.getText(sourceFile),
              fix: 'Secrets must be required or conditionally required, not defaulted.',
            },
          );
        });
      });
  },
};

const std11: QualityRule = {
  id: 'STD-11',
  category: 'Security',
  severity: 'low',
  status: 'implemented',
  defaultLevel: 'fail',
  source: 'docs/security-standards.md / ADR-0014',
  description:
    'Environment variables are represented in validation, typed config, and examples.',
  async run(context) {
    const envExampleFile = '.env.example';
    const validationFile = 'src/common/config/env.validation.ts';
    const files = filesForRule(context);
    const shouldRun =
      context.scope.mode === 'audit' ||
      files.includes(envExampleFile) ||
      files.includes(validationFile) ||
      files.some((file) => file.startsWith('src/common/config/'));

    if (!shouldRun) return [];

    const exampleContent = readFileSync(envExampleFile, 'utf8');
    const validationContent = readFileSync(validationFile, 'utf8');
    const exampleKeys = new Set(
      [...exampleContent.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(
        (match) => match[1],
      ),
    );
    const validationKeys = [
      ...validationContent.matchAll(/^\s*([A-Z][A-Z0-9_]*):\s*Joi\./gm),
    ].map((match) => match[1]);

    return validationKeys.flatMap((key) => {
      if (exampleKeys.has(key)) return [];

      return createFinding(std11, 'Env var missing from .env.example.', {
        file: envExampleFile,
        detail: key,
        fix: 'Add the validated env var to .env.example.',
      });
    });
  },
};

export const SECURITY_RULES: QualityRule[] = [
  std04,
  sec01,
  sec02,
  sec06,
  sec07,
  sec08,
  std11,
];
