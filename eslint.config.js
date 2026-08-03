import js from '@eslint/js';
import globals from 'globals';

const googleAppsScriptGlobals = {
  CalendarApp: 'readonly',
  ContentService: 'readonly',
  DriveApp: 'readonly',
  GmailApp: 'readonly',
  HtmlService: 'readonly',
  LockService: 'readonly',
  Logger: 'readonly',
  MimeType: 'readonly',
  PropertiesService: 'readonly',
  ScriptApp: 'readonly',
  SpreadsheetApp: 'readonly',
  UrlFetchApp: 'readonly',
  Utilities: 'readonly',
};

export default [
  {
    ignores: ['coverage/**', 'dist/**', 'node_modules/**'],
  },
  {
    files: ['*.js', 'scripts/**/*.js', 'scripts/**/*.mjs'],
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
  },
  {
    files: ['src/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.es2021,
        ...googleAppsScriptGlobals,
        console: 'readonly',
      },
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^https?:\\/\\//]',
          message: 'Do not hardcode URLs. Resolve endpoints through ConfigService.',
        },
      ],
    },
  },
];
