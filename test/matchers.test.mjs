import { describe, it, expect, beforeAll } from 'vitest';
import { loadSharedScripts } from './helpers/loadScript.mjs';

let ctx;
beforeAll(() => {
  ctx = loadSharedScripts('shared/blocklists.js', 'shared/matchers.js');
});

describe('WFB_normalizeHost', () => {
  it('met en minuscules et retire le préfixe www.', () => {
    expect(ctx.WFB_normalizeHost('WWW.Example.COM')).toBe('example.com');
    expect(ctx.WFB_normalizeHost('sub.Example.com')).toBe('sub.example.com');
  });
  it('gère les entrées vides/nulles', () => {
    expect(ctx.WFB_normalizeHost('')).toBe('');
    expect(ctx.WFB_normalizeHost(null)).toBe('');
    expect(ctx.WFB_normalizeHost(undefined)).toBe('');
  });
  it('ne retire que le www. en tête (pas « www » au milieu)', () => {
    expect(ctx.WFB_normalizeHost('mywww.example.com')).toBe('mywww.example.com');
  });
});

describe('WFB_hostInList', () => {
  const list = ['popads.net', 'doubleclick.net'];

  it('correspond au domaine exact', () => {
    expect(ctx.WFB_hostInList('popads.net', list)).toBe(true);
  });
  it('correspond aux sous-domaines', () => {
    expect(ctx.WFB_hostInList('cdn.popads.net', list)).toBe(true);
    expect(ctx.WFB_hostInList('a.b.doubleclick.net', list)).toBe(true);
  });
  it('normalise avant comparaison (casse + www.)', () => {
    expect(ctx.WFB_hostInList('WWW.PopAds.net', list)).toBe(true);
  });
  it('ne matche pas un faux suffixe (évite notpopads.net)', () => {
    expect(ctx.WFB_hostInList('notpopads.net', list)).toBe(false);
    expect(ctx.WFB_hostInList('popads.net.evil.com', list)).toBe(false);
  });
  it('renvoie false pour hôte vide ou liste invalide', () => {
    expect(ctx.WFB_hostInList('', list)).toBe(false);
    expect(ctx.WFB_hostInList('popads.net', null)).toBe(false);
  });
});

describe('WFB_patternInHost', () => {
  const patterns = ['filemoon', 'streamtape'];
  it('matche une sous-chaîne du hostname', () => {
    expect(ctx.WFB_patternInHost('cdn-filemoon.sx', patterns)).toBe(true);
    expect(ctx.WFB_patternInHost('streamtape.to', patterns)).toBe(true);
  });
  it('ne matche pas un motif absent', () => {
    expect(ctx.WFB_patternInHost('example.com', patterns)).toBe(false);
  });
});

describe('WFB_hostnameFromUrl', () => {
  it('extrait le hostname d’une URL absolue', () => {
    expect(ctx.WFB_hostnameFromUrl('https://www.popads.net/x?y=1')).toBe('www.popads.net');
  });
  it('résout une URL relative avec une base', () => {
    expect(ctx.WFB_hostnameFromUrl('/path', 'https://example.com')).toBe('example.com');
  });
  it('renvoie null pour les URL non pertinentes', () => {
    expect(ctx.WFB_hostnameFromUrl('about:blank')).toBeNull();
    expect(ctx.WFB_hostnameFromUrl('chrome://extensions')).toBeNull();
    expect(ctx.WFB_hostnameFromUrl('pas une url', undefined)).toBeNull();
    expect(ctx.WFB_hostnameFromUrl('')).toBeNull();
    expect(ctx.WFB_hostnameFromUrl(null)).toBeNull();
  });
});

describe('intégration listes + matchers', () => {
  it('reconnaît un domaine pub réel de la liste', () => {
    expect(ctx.WFB_hostInList('ads.doubleclick.net', ctx.WFB_AD_DOMAINS)).toBe(true);
  });
  it('reconnaît un site de streaming de la liste', () => {
    expect(ctx.WFB_hostInList('www.webflix.lol', ctx.WFB_STREAMING_SITES)).toBe(true);
  });
  it('un site de streaming n’est pas dans la liste pub', () => {
    expect(ctx.WFB_hostInList('webflix.lol', ctx.WFB_AD_DOMAINS)).toBe(false);
  });
});
