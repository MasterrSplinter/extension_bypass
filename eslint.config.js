import js from '@eslint/js';
import globals from 'globals';

// Globales partagées par shared/blocklists.js et shared/matchers.js
// (injectées dans tous les contextes via le manifest / importScripts).
const wfbGlobals = {
  WFB_AD_DOMAINS: 'readonly',
  WFB_STREAMING_SITES: 'readonly',
  WFB_BRAND_ROOTS: 'readonly',
  WFB_NAV_WHITELIST: 'readonly',
  WFB_CLICK_WHITELIST: 'readonly',
  WFB_PLAYER_SOURCE_PATTERNS: 'readonly',
  WFB_DEFAULT_RULES_COUNT: 'readonly',
  WFB_normalizeHost: 'readonly',
  WFB_hostInList: 'readonly',
  WFB_patternInHost: 'readonly',
  WFB_hostnameFromUrl: 'readonly'
};

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        ...globals.serviceworker
      }
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['warn', { allowEmptyCatch: true }]
    }
  },
  {
    // Les consommateurs lisent les globales partagées ; les fichiers qui les
    // définissent sont exclus pour éviter no-redeclare / no-unused-vars.
    files: ['src/**/*.js'],
    ignores: ['src/shared/blocklists.js', 'src/shared/matchers.js'],
    languageOptions: { globals: wfbGlobals }
  },
  {
    // Ces fichiers déclarent des globales consommées ailleurs : ne pas les marquer inutilisées.
    files: ['src/shared/blocklists.js', 'src/shared/matchers.js'],
    rules: { 'no-unused-vars': 'off' }
  }
];
