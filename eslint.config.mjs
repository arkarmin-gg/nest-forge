// @ts-check
import eslint from '@eslint/js';
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
    // Enforce module boundary contracts: cross-module imports must go through index.ts,
    // not via deep internal paths. This prevents accidental coupling to internal details.
    files: ['src/modules/**/*.ts', 'src/api/**/*.ts', 'src/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            // Disallow importing into another module's internals (skip own module and common/)
            {
              group: ['src/modules/auth/services/*', 'src/modules/auth/guards/*', 'src/modules/auth/strategies/*', 'src/modules/auth/decorators/*', 'src/modules/auth/entities/*', 'src/modules/auth/dto/*', 'src/modules/auth/interfaces/*', 'src/modules/auth/events/*'],
              message: 'Import from src/modules/auth (index.ts) instead of deep paths',
            },
            {
              group: ['src/modules/user/services/*', 'src/modules/user/entities/*', 'src/modules/user/dto/*'],
              message: 'Import from src/modules/user (index.ts) instead of deep paths',
            },
            {
              group: ['src/modules/admin/services/*', 'src/modules/admin/entities/*', 'src/modules/admin/dto/*'],
              message: 'Import from src/modules/admin (index.ts) instead of deep paths',
            },
            {
              group: ['src/modules/otp/services/*', 'src/modules/otp/entities/*'],
              message: 'Import from src/modules/otp (index.ts) instead of deep paths',
            },
            {
              group: ['src/modules/log/services/*', 'src/modules/log/interceptors/*', 'src/modules/log/constants/*', 'src/modules/log/events/*', 'src/modules/log/decorators/*', 'src/modules/log/interfaces/*'],
              message: 'Import from src/modules/log (index.ts) instead of deep paths',
            },
          ],
        },
      ],
    },
  },
  {
    // Entity files have legitimate circular cross-module TypeORM relationships;
    // routing them through barrel files would create circular module issues.
    files: ['src/**/*.entity.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
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
