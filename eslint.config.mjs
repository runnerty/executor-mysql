import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  {
    ignores: ['**/.vscode', '**/api', '**/node_modules', '**/samples', '**/*.md', '**/*.json', '**/LICENSE']
  },
  ...compat.extends('plugin:prettier/recommended'),
  {
    languageOptions: {
      globals: {
        ...globals.node,
        Promise: true,
        global: true
      },

      ecmaVersion: 2021,
      sourceType: 'module',

      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },

    rules: {
      indent: [
        'error',
        2,
        {
          SwitchCase: 1
        }
      ],

      'default-case': 'error',
      'linebreak-style': ['error', 'unix'],
      semi: ['error', 'always'],
      'no-console': 'error',
      'no-undef': 'error',
      'no-var': 'error',
      'no-caller': 'error',
      'no-throw-literal': 'error',
      'no-unneeded-ternary': 'error',
      'prefer-const': 'error',

      'comma-spacing': [
        'error',
        {
          before: false,
          after: true
        }
      ],

      'comma-style': ['error', 'last'],
      'handle-callback-err': ['error', '^(err|error)$']
    }
  }
];
