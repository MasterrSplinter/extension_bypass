import { defineConfig } from 'vitest/config';

// Tests unitaires uniquement (les tests e2e Playwright vivent dans test/e2e/).
export default defineConfig({
  test: {
    include: ['test/*.test.mjs']
  }
});
