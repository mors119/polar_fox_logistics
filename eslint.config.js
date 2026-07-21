import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const googleAppsScriptGlobals = {
  CalendarApp: 'readonly',
  ContentService: 'readonly',
  DriveApp: 'readonly',
  GmailApp: 'readonly',
  HtmlService: 'readonly',
  Logger: 'readonly',
  MimeType: 'readonly',
  PropertiesService: 'readonly',
  SpreadsheetApp: 'readonly',
  UrlFetchApp: 'readonly',
};

export default tseslint.config(
  {
    ignores: ['coverage/**', 'dist/**', 'node_modules/**'],
  },
  {
    files: ['**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
        ...googleAppsScriptGlobals,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^https?:\\/\\//]',
          message: 'Do not hardcode URLs. Resolve endpoints through ConfigService.',
        },
      ],
    },
  },
);
