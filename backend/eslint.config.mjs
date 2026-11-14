import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'node_modules',
      'prisma/migrations',
      'tests',
      'jest.config.cjs',
      'tests/globalSetup.cjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['src/**/*.ts', 'prisma/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: false, project: false },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['**/*.{mjs,mts,cjs}'],
    languageOptions: {
      globals: { ...globals.node, module: 'readonly' },
      parserOptions: { projectService: false, project: false },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
