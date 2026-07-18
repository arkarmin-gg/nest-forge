import { existsSync, readdirSync } from 'fs';
import * as ts from 'typescript';

import { createSourceFile, findNodes, getLineAndColumn } from '../ast';
import { QualityRule } from '../types';
import { createFinding, filesForRule, isTypeScriptFile } from './rule-utils';

function listModuleDirs(): string[] {
  if (!existsSync('src/modules')) return [];

  return readdirSync('src/modules', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `src/modules/${entry.name}`);
}

function moduleDirsForContext(files: string[]): string[] {
  const touchedModules = new Set<string>();

  for (const file of files) {
    const match = /^src\/modules\/([^/]+)\//.exec(file);
    if (match) touchedModules.add(`src/modules/${match[1]}`);
  }

  return [...touchedModules].sort((a, b) => a.localeCompare(b));
}

function getExportedNames(file: string): {
  names: Set<string>;
  wildcardLines: number[];
} {
  const sourceFile = createSourceFile(file);
  const names = new Set<string>();
  const wildcardLines: number[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement)) continue;

    if (!statement.exportClause) {
      wildcardLines.push(
        getLineAndColumn(sourceFile, statement.getStart()).line,
      );
      continue;
    }

    if (!ts.isNamedExports(statement.exportClause)) {
      wildcardLines.push(
        getLineAndColumn(sourceFile, statement.getStart()).line,
      );
      continue;
    }

    for (const element of statement.exportClause.elements) {
      names.add(element.name.text);
    }
  }

  return { names, wildcardLines };
}

const arch05: QualityRule = {
  id: 'ARCH-05',
  category: 'Architecture',
  severity: 'medium',
  status: 'implemented',
  defaultLevel: 'fail',
  source: 'ARCHITECTURE.md §5 / ADR-0013',
  description:
    'Domain modules expose index.ts and public-api.ts with named, non-overlapping exports.',
  async run(context) {
    const moduleDirs =
      context.scope.mode === 'audit'
        ? listModuleDirs()
        : moduleDirsForContext(context.targetFiles);

    return moduleDirs.flatMap((moduleDir) => {
      const findings = [];
      const indexFile = `${moduleDir}/index.ts`;
      const publicApiFile = `${moduleDir}/public-api.ts`;

      if (!existsSync(indexFile)) {
        findings.push(
          createFinding(arch05, 'Domain module is missing index.ts.', {
            file: indexFile,
            fix: 'Add a named-export domain barrel for entities, events, enums, and constants.',
          }),
        );
      }

      if (!existsSync(publicApiFile)) {
        findings.push(
          createFinding(arch05, 'Domain module is missing public-api.ts.', {
            file: publicApiFile,
            fix: 'Add a named-export public API barrel for services, DTOs, decorators, and guards.',
          }),
        );
      }

      if (!existsSync(indexFile) || !existsSync(publicApiFile)) return findings;

      const indexExports = getExportedNames(indexFile);
      const publicApiExports = getExportedNames(publicApiFile);

      for (const line of indexExports.wildcardLines) {
        findings.push(
          createFinding(arch05, 'Wildcard export found in index.ts.', {
            file: indexFile,
            line,
            fix: 'Use named exports only.',
          }),
        );
      }

      for (const line of publicApiExports.wildcardLines) {
        findings.push(
          createFinding(arch05, 'Wildcard export found in public-api.ts.', {
            file: publicApiFile,
            line,
            fix: 'Use named exports only.',
          }),
        );
      }

      for (const name of indexExports.names) {
        if (!publicApiExports.names.has(name)) continue;

        findings.push(
          createFinding(
            arch05,
            `Symbol ${name} is exported from both index.ts and public-api.ts.`,
            {
              file: publicApiFile,
              fix: 'Choose exactly one canonical barrel for the symbol.',
            },
          ),
        );
      }

      return findings;
    });
  },
};

const arch09: QualityRule = {
  id: 'ARCH-09',
  category: 'Architecture',
  severity: 'medium',
  status: 'implemented',
  defaultLevel: 'fail',
  source: 'ARCHITECTURE.md §5 / ADR-0013',
  description:
    'Barrel files exist only at sanctioned module and common subfolder boundaries.',
  async run(context) {
    return filesForRule(context)
      .filter((file) => file.endsWith('/index.ts') || file.endsWith('index.ts'))
      .flatMap((file) => {
        const moduleRootBarrel = /^src\/modules\/[^/]+\/index\.ts$/.test(file);
        const modulePublicApi = /^src\/modules\/[^/]+\/public-api\.ts$/.test(
          file,
        );
        const commonSubfolderBarrel = /^src\/common\/[^/]+\/index\.ts$/.test(
          file,
        );

        if (moduleRootBarrel || modulePublicApi || commonSubfolderBarrel) {
          return [];
        }

        if (
          !file.startsWith('src/modules/') &&
          !file.startsWith('src/common/')
        ) {
          return [];
        }

        return createFinding(arch09, 'Unsanctioned barrel file found.', {
          file,
          fix: 'Keep barrels only at module roots and common subfolder boundaries.',
        });
      });
  },
};

const arch10: QualityRule = {
  id: 'ARCH-10',
  category: 'Architecture',
  severity: 'medium',
  status: 'implemented',
  defaultLevel: 'fail',
  source: 'ARCHITECTURE.md §5 / ADR-0013',
  description:
    "A module's own implementation files do not import from that same module's root barrel.",
  async run(context) {
    return filesForRule(context)
      .filter((file) => file.startsWith('src/modules/'))
      .filter(isTypeScriptFile)
      .filter(
        (file) => !/^src\/modules\/[^/]+\/(index|public-api)\.ts$/.test(file),
      )
      .flatMap((file) => {
        const moduleMatch = /^src\/modules\/([^/]+)\//.exec(file);
        if (!moduleMatch) return [];

        const moduleName = moduleMatch[1];
        const sourceFile = createSourceFile(file);

        return findNodes(sourceFile, ts.isImportDeclaration).flatMap((node) => {
          if (!ts.isStringLiteral(node.moduleSpecifier)) return [];

          const importPath = node.moduleSpecifier.text;
          const ownBarrels = [
            `src/modules/${moduleName}`,
            `src/modules/${moduleName}/index`,
            `src/modules/${moduleName}/public-api`,
          ];

          if (!ownBarrels.includes(importPath)) return [];

          const location = getLineAndColumn(sourceFile, node.getStart());
          return createFinding(
            arch10,
            'Own-module implementation imports through its root barrel.',
            {
              file,
              ...location,
              fix: 'Use a relative direct import inside the owning module.',
            },
          );
        });
      });
  },
};

export const ARCHITECTURE_RULES: QualityRule[] = [arch05, arch09, arch10];
