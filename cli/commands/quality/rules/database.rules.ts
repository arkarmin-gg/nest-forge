import * as ts from 'typescript';

import {
  createSourceFile,
  expressionIsString,
  expressionIsTrue,
  findNodes,
  getDecorators,
  getLineAndColumn,
  objectLiteralHasProperty,
} from '../ast';
import { QualityRule } from '../types';
import { createFinding, filesForRule } from './rule-utils';

function getObjectArguments(
  decoratorArguments: ts.NodeArray<ts.Expression>,
): ts.ObjectLiteralExpression[] {
  return decoratorArguments.filter(ts.isObjectLiteralExpression);
}

function propertyDecorators(sourceFile: ts.SourceFile) {
  return findNodes(sourceFile, ts.isPropertyDeclaration).flatMap((property) =>
    getDecorators(property).map((decorator) => ({ property, decorator })),
  );
}

const std02: QualityRule = {
  id: 'STD-02',
  category: 'Database',
  severity: 'high',
  status: 'implemented',
  defaultLevel: 'fail',
  source: 'docs/database-standards.md / ADR-0007',
  description:
    'Soft-deletable entities do not use unconditional @Column unique constraints.',
  async run(context) {
    return filesForRule(context)
      .filter((file) => file.startsWith('src/modules/'))
      .filter((file) => file.endsWith('.entity.ts'))
      .flatMap((file) => {
        const sourceFile = createSourceFile(file);
        const softDeletableClasses = findNodes(
          sourceFile,
          ts.isClassDeclaration,
        ).filter((classDeclaration) =>
          (classDeclaration.heritageClauses ?? []).some((clause) =>
            clause.types.some(
              (type) =>
                type.expression.getText(sourceFile) === 'SoftDeletableEntity',
            ),
          ),
        );

        if (softDeletableClasses.length === 0) return [];

        return propertyDecorators(sourceFile).flatMap(({ decorator }) => {
          if (decorator.name !== 'Column') return [];

          const hasUnique = getObjectArguments(decorator.arguments).some(
            (objectLiteral) =>
              objectLiteralHasProperty(
                objectLiteral,
                'unique',
                expressionIsTrue,
              ),
          );
          if (!hasUnique) return [];

          const location = getLineAndColumn(
            sourceFile,
            decorator.node.getStart(),
          );
          return createFinding(
            std02,
            'Unconditional unique column found on a soft-deletable entity.',
            {
              file,
              ...location,
              fix: 'Use a partial unique index scoped to "deleted_at" IS NULL.',
            },
          );
        });
      });
  },
};

const std12: QualityRule = {
  id: 'STD-12',
  category: 'Database',
  severity: 'high',
  status: 'implemented',
  defaultLevel: 'fail',
  source: 'docs/database-standards.md / ADR-0009',
  description:
    'Entities use varchar plus TypeScript enums instead of native database enum columns.',
  async run(context) {
    return filesForRule(context)
      .filter((file) => file.startsWith('src/modules/'))
      .filter((file) => file.endsWith('.entity.ts'))
      .flatMap((file) => {
        const sourceFile = createSourceFile(file);

        return propertyDecorators(sourceFile).flatMap(({ decorator }) => {
          if (decorator.name !== 'Column') return [];

          const hasEnumType = getObjectArguments(decorator.arguments).some(
            (objectLiteral) =>
              objectLiteralHasProperty(objectLiteral, 'type', (initializer) =>
                expressionIsString(initializer, 'enum'),
              ),
          );
          if (!hasEnumType) return [];

          const location = getLineAndColumn(
            sourceFile,
            decorator.node.getStart(),
          );
          return createFinding(std12, 'Native database enum column found.', {
            file,
            ...location,
            fix: 'Use varchar plus a TypeScript enum and migration CHECK constraint.',
          });
        });
      });
  },
};

const std13: QualityRule = {
  id: 'STD-13',
  category: 'Database',
  severity: 'medium',
  status: 'implemented',
  defaultLevel: 'fail',
  source: 'docs/database-standards.md',
  description: 'TypeORM relations do not use eager loading.',
  async run(context) {
    return filesForRule(context)
      .filter((file) => file.startsWith('src/modules/'))
      .filter((file) => file.endsWith('.entity.ts'))
      .flatMap((file) => {
        const sourceFile = createSourceFile(file);

        return propertyDecorators(sourceFile).flatMap(({ decorator }) => {
          const relationDecorators = ['ManyToOne', 'OneToMany', 'ManyToMany'];
          if (!relationDecorators.includes(decorator.name)) return [];

          const hasEager = getObjectArguments(decorator.arguments).some(
            (objectLiteral) =>
              objectLiteralHasProperty(
                objectLiteral,
                'eager',
                expressionIsTrue,
              ),
          );
          if (!hasEager) return [];

          const location = getLineAndColumn(
            sourceFile,
            decorator.node.getStart(),
          );
          return createFinding(std13, 'Eager relation loading found.', {
            file,
            ...location,
            fix: 'Load relations explicitly with relations or query-builder joins.',
          });
        });
      });
  },
};

const std14: QualityRule = {
  id: 'STD-14',
  category: 'Database',
  severity: 'low',
  status: 'implemented',
  defaultLevel: 'fail',
  source: 'docs/database-standards.md',
  description: '@ManyToOne relations set onDelete explicitly.',
  async run(context) {
    return filesForRule(context)
      .filter((file) => file.startsWith('src/modules/'))
      .filter((file) => file.endsWith('.entity.ts'))
      .flatMap((file) => {
        const sourceFile = createSourceFile(file);

        return propertyDecorators(sourceFile).flatMap(({ decorator }) => {
          if (decorator.name !== 'ManyToOne') return [];

          const hasOnDelete = getObjectArguments(decorator.arguments).some(
            (objectLiteral) =>
              objectLiteralHasProperty(objectLiteral, 'onDelete', () => true),
          );
          if (hasOnDelete) return [];

          const location = getLineAndColumn(
            sourceFile,
            decorator.node.getStart(),
          );
          return createFinding(
            std14,
            '@ManyToOne is missing explicit onDelete.',
            {
              file,
              ...location,
              fix: 'Set onDelete to CASCADE, SET NULL, or RESTRICT per ownership.',
            },
          );
        });
      });
  },
};

export const DATABASE_RULES: QualityRule[] = [std02, std12, std13, std14];
