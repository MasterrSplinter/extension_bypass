import { describe, it, expect, beforeAll } from 'vitest';
import { loadSharedScripts } from './helpers/loadScript.mjs';

let ctx;
beforeAll(() => {
  ctx = loadSharedScripts('shared/blocklists.js');
});

const LISTS = [
  'WFB_AD_DOMAINS',
  'WFB_STREAMING_SITES',
  'WFB_NAV_WHITELIST',
  'WFB_CLICK_WHITELIST',
  'WFB_PLAYER_SOURCE_PATTERNS'
];

describe('intégrité des listes partagées', () => {
  it('toutes les listes sont des tableaux non vides', () => {
    for (const name of LISTS) {
      expect(Array.isArray(ctx[name]), name).toBe(true);
      expect(ctx[name].length, name).toBeGreaterThan(0);
    }
  });

  it('aucune liste ne contient de doublon', () => {
    for (const name of LISTS) {
      const arr = ctx[name];
      const dups = arr.filter((v, i) => arr.indexOf(v) !== i);
      expect(dups, `${name} contient des doublons: ${[...new Set(dups)].join(', ')}`).toEqual([]);
    }
  });

  it('les domaines sont normalisés (minuscule, sans www., sans slash)', () => {
    for (const name of ['WFB_AD_DOMAINS', 'WFB_STREAMING_SITES', 'WFB_NAV_WHITELIST', 'WFB_CLICK_WHITELIST']) {
      for (const d of ctx[name]) {
        expect(d, `${name}: « ${d} »`).toBe(d.toLowerCase());
        expect(d.startsWith('www.'), `${name}: « ${d} »`).toBe(false);
        expect(d.includes('/'), `${name}: « ${d} »`).toBe(false);
      }
    }
  });

  it('WFB_DEFAULT_RULES_COUNT est un entier positif', () => {
    expect(Number.isInteger(ctx.WFB_DEFAULT_RULES_COUNT)).toBe(true);
    expect(ctx.WFB_DEFAULT_RULES_COUNT).toBeGreaterThan(0);
  });
});
