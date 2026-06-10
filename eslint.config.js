import js from '@eslint/js';
import globals from 'globals';

// Globales partagées par shared/blocklists.js (injectées dans tous les contextes)
const wfbGlobals = {
  WFB_AD_DOMAINS: 'readonly',
  WFB_STREAMING_SITES: 'readonly',
  WFB_NAV_WHITELIST: 'readonly',
  WFB_CLICK_WHITELIST: 'readonly',
  WFB_PLAYER_SOURCE_PATTERNS: 'readonly',
  WFB_DEFAULT_RULES_COUNT: 'readonly'
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
    // Les consommateurs lisent les listes comme des globales ; le fichier qui les
    // définit (blocklists.js) est exclu pour éviter no-redeclare / no-unused-vars.
    files: ['src/**/*.js'],
    ignores: ['src/shared/blocklists.js'],
    languageOptions: { globals: wfbGlobals }
  },
  {
    // blocklists.js déclare des globales consommées ailleurs : ne pas les marquer inutilisées.
    files: ['src/shared/blocklists.js'],
    rules: { 'no-unused-vars': 'off' }
  }
];
