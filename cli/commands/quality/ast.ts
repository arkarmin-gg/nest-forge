import { readFileSync } from 'fs';
import * as ts from 'typescript';

export interface DecoratorInfo {
  name: string;
  node: ts.Decorator;
  arguments: ts.NodeArray<ts.Expression>;
}

export function createSourceFile(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

export function getLineAndColumn(sourceFile: ts.SourceFile, position: number) {
  const { line, character } =
    sourceFile.getLineAndCharacterOfPosition(position);
  return {
    line: line + 1,
    column: character + 1,
  };
}

function getDecoratorName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isCallExpression(expression)) {
    const callExpression = expression.expression;
    if (ts.isIdentifier(callExpression)) return callExpression.text;
  }

  return undefined;
}

export function getDecorators(node: ts.Node): DecoratorInfo[] {
  if (!ts.canHaveDecorators(node)) return [];

  return (ts.getDecorators(node) ?? []).flatMap((decorator) => {
    const name = getDecoratorName(decorator.expression);
    if (!name) return [];

    return [
      {
        name,
        node: decorator,
        arguments: ts.isCallExpression(decorator.expression)
          ? decorator.expression.arguments
          : ts.factory.createNodeArray(),
      },
    ];
  });
}

export function objectLiteralHasProperty(
  objectLiteral: ts.ObjectLiteralExpression,
  propertyName: string,
  predicate: (initializer: ts.Expression) => boolean,
): boolean {
  return objectLiteral.properties.some((property) => {
    if (!ts.isPropertyAssignment(property)) return false;

    const name = property.name;
    const matchesName =
      (ts.isIdentifier(name) && name.text === propertyName) ||
      (ts.isStringLiteral(name) && name.text === propertyName);

    return matchesName && predicate(property.initializer);
  });
}

export function getPropertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return undefined;
}

export function getObjectLiteralProperty(
  objectLiteral: ts.ObjectLiteralExpression,
  propertyName: string,
): ts.Expression | undefined {
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) continue;

    const name = property.name;
    const matchesName =
      (ts.isIdentifier(name) && name.text === propertyName) ||
      (ts.isStringLiteral(name) && name.text === propertyName);

    if (matchesName) return property.initializer;
  }

  return undefined;
}

export function expressionIsTrue(expression: ts.Expression): boolean {
  return expression.kind === ts.SyntaxKind.TrueKeyword;
}

export function expressionIsString(
  expression: ts.Expression,
  value: string,
): boolean {
  return ts.isStringLiteral(expression) && expression.text === value;
}

export function findNodes<T extends ts.Node>(
  sourceFile: ts.SourceFile,
  predicate: (node: ts.Node) => node is T,
): T[] {
  const nodes: T[] = [];

  function visit(node: ts.Node): void {
    if (predicate(node)) nodes.push(node);
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return nodes;
}
