// @ts-check
import eslint from '@eslint/js';
import importX from 'eslint-plugin-import-x';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Enforce module boundary contracts: cross-module imports must go through the
    // module's barrel (index.ts / public-api.ts), not via deep internal paths. This prevents
    // accidental coupling to internal details.
    files: [
      'src/modules/**/*.ts',
      'src/api/**/*.ts',
      'src/infrastructure/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            // ONE rule for ALL modules — no per-module maintenance when adding a new one.
            // A module's public barrels (`src/modules/<m>`, `.../index`, `.../public-api`) sit one
            // level under the module dir and stay importable; anything inside a subdirectory
            // (services/, entities/, dto/, guards/, ...) is a deep import and blocked.
            // Own-module code reaches its internals via RELATIVE paths, which these absolute
            // `src/modules/...` patterns never match — so self-imports are unaffected.
            // (`*.entity.ts` files are exempted below for cross-module TypeORM relations.)
            {
              group: ['src/modules/*/*/*', 'src/modules/*/*/*/**'],
              message:
                "Deep import into a module's internals. Import from its barrel instead: 'src/modules/<module>' (index.ts) or 'src/modules/<module>/public-api'.",
            },
          ],
        },
      ],
    },
  },
  {
    // Prevent circular import dependencies between modules/services. A real cycle
    // (e.g. service A -> service B -> service A through the public barrels) errors.
    files: [
      'src/modules/**/*.ts',
      'src/api/**/*.ts',
      'src/infrastructure/**/*.ts',
      'src/common/**/*.ts',
    ],
    plugins: { 'import-x': importX },
    settings: {
      // import-x must parse imported .ts files to follow the dependency graph;
      // without this, no-cycle resolves paths but never reads their imports.
      'import-x/parsers': { '@typescript-eslint/parser': ['.ts'] },
      'import-x/resolver': {
        typescript: { project: './tsconfig.json' },
      },
    },
    rules: {
      'import-x/no-cycle': [
        'error',
        { maxDepth: Infinity, ignoreExternal: true },
      ],
    },
  },
  {
    // Entity files have legitimate circular cross-module TypeORM relationships;
    // routing them through barrel files would create circular module issues.
    // Must come AFTER the no-cycle block so the override wins for *.entity.ts.
    files: ['src/**/*.entity.ts'],
    rules: {
      'no-restricted-imports': 'off',
      'import-x/no-cycle': 'off',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/require-await': 'warn',
    },
  },
);
