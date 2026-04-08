import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import nodePlugin from 'eslint-plugin-n';
import securityPlugin from 'eslint-plugin-security';
import globals from 'globals';

export default [
  js.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.ts'],
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin,
      node: nodePlugin,
      security: securityPlugin,
    },

    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },

    rules: {
      ...tsPlugin.configs.recommended.rules,
    
      // Prettier
      'prettier/prettier': 'error',
    
      // Disable basic rules in favor of TypeScript versions
      'no-unused-vars': 'off',
      'require-await': 'off',
      'no-throw-literal': 'off',
    
      // General rules
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: 'next' }],
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
    
      // General rules that don't have TS versions
      'no-console': 'warn',
      'no-var': 'error',
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always'],
      'no-async-promise-executor': 'error',
      'no-await-in-loop': 'warn',
    
      // Node.js
      'node/no-deprecated-api': 'error',
      'node/no-missing-import': 'off',
    
      // Security
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-eval-with-expression': 'error',
    },
  },
  {
    files: ['tests/**/*.js', '**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      'no-console': 'off',
      'node/no-missing-import': 'off',
      'security/detect-object-injection': 'off',
    },
  },
];
