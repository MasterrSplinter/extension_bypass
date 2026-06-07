#!/usr/bin/env node
/**
 * tests/run.mjs — Test runner minimal
 * Exécuter : node tests/run.mjs  OU  npm test
 */

console.log('🧪 Streaming AdBlocker Pro — Tests unitaires\n');

try {
  await import('./domains.test.mjs');
} catch (err) {
  console.error('❌ Erreur lors de l\'exécution des tests :', err);
  process.exit(1);
}
