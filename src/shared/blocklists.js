/**
 * blocklists.js — Source unique de vérité pour les listes de domaines.
 *
 * Chargé dans plusieurs contextes, tous en script « classique » (pas de module) :
 *   - Service worker  : via importScripts() (Chrome) ou le tableau `scripts` (Firefox)
 *   - content.js      : en première entrée du tableau `js` du content_script (monde ISOLATED)
 *   - popup.js        : via une balise <script> avant popup.js
 *
 * Chaque fichier déclare ses constantes dans la portée globale de son contexte
 * (var au niveau racine), puis les lit directement. main_world.js (monde MAIN)
 * reste volontairement autonome : il s'exécute dans le contexte de la page et ne
 * peut pas partager ce scope sans injection réseau/CSP supplémentaire.
 */
'use strict';

// ── Régies / domaines publicitaires connus (liste dédupliquée et unifiée) ──
var WFB_AD_DOMAINS = [
  'popads.net', 'popcash.net', 'exoclick.com', 'trafficjunky.net',
  'juicyads.com', 'adsterra.com', 'propellerads.com', 'hilltopads.net',
  'bidvertiser.com', 'mgid.com', 'revcontent.com', 'taboola.com',
  'outbrain.com', 'googlesyndication.com', 'doubleclick.net',
  'googleadservices.com', 'adsafeprotected.com', 'pupupul.site',
  'clkme.me', 'adspyglass.com', 'moonads.to', 'clickaine.com',
  'tsyndicate.com', 'creativecdn.com', 'smartadserver.com', 'adbull.me',
  'adnxs.com', 'sheety.co', 'moonadsq.to', 'miniroad.store',
  'stake.com', 'playafterdark.com', 'otieu.com', 'foreignabnormality.com',
  'adnium.com', 'plugrush.com', 'push.house', 'evadav.com',
  'galaksion.com', 'kadam.net', 'richpush.co', 'traficshop.com',
  'rtmark.net', 'adxpansion.com', 'jucyadsnew.com', 'ero-advertising.com',
  'realsrv.com', 'adspirit.de', 'clicksfly.com', 'ouo.io',
  'shrinkme.io', 'exe.io', 'short.pe', 'gplinks.co', 'northseize.com'
];

// ── Sites de streaming protégés (doit rester aligné avec content_scripts.matches) ──
var WFB_STREAMING_SITES = [
  'senpai-stream.quest', 'webflix.lol', 'french-stream.ac', 'frenchstream.wtf',
  'papystreaming.tv', 'voiranime.com', 'filmcomplet.link', 'streamcomplet.app',
  'wiflix.st', 'annuaire-telechargement.art', 'dpstreaming.to', 'dpstreaming.ink',
  'cpasmieux.com', 'cpasmieux.pro', 'zone-telechargement.beauty', 'vostfree.tv',
  'neko-sama.fr', 'anime-sama.fr', 'mavanime.org'
];

// ── Whitelist « navigation » (large) : nouveaux onglets jamais fermés par le SW ──
var WFB_NAV_WHITELIST = [
  // Sites de streaming
  'senpai-stream.quest', 'webflix.lol', 'french-stream.ac', 'frenchstream.wtf', 'papystreaming.tv',
  'voiranime.com', 'filmcomplet.link', 'streamcomplet.app', 'wiflix.st',
  // Lecteurs vidéo
  'wavewatch.top', 'apis.wavewatch.top', 'bysebuho.com', 'nzn3.org',
  'player4k.com', 'viperstreamz.com', 'viperstream.xyz', 'viperstre.am', 'viper4k.com',
  'streamvid.net', 'embedme.top', 'embtaku.com',
  'filemoon.sx', 'filemoon.in', 'filemoon.com', 'filemoon.to',
  'doodstream.com', 'dood.wf', 'dood.cx', 'dood.la', 'dood.re', 'dood.pm',
  'sibnet.ru', 'uqload.com', 'uqload.co', 'uqload.io',
  'sendvid.com', 'streamlare.com', 'upstream.to', 'vidoza.net',
  'voe.sx', 'voe.bar', 'voe.run', 'voe.click',
  'streamtape.com', 'streamtape.net', 'streamtape.to',
  'turbovid.me', 'supervideo.tv', 'netu.ac', 'netuplayer.top',
  'mixdrop.ag', 'mixdrop.bz', 'mixdrop.ch', 'mixdrop.co', 'mixdrop.gl', 'mixdrop.to',
  'myviid.eu', 'myviid.com', 'gounlimited.to', 'evoload.io',
  'fembed.com', 'fembed.net', 'femax20.com', 'fembad.org', 'fvs.io',
  'bflyv.com', 'fastream.to', 'mp4upload.com', 'flash-vars.com',
  'wishembed.download', 'cloudvideo.tv', 'yourupload.com',
  'aidolove.com', 'dropload.io', 'playerx.stream', 'hlsplayer.net',
  'speedostream.com', 'streamta.pe', 'vidhd.fun', 'vidalyze.com',
  'dailymotion.com', '1fichier.com',
  // Services standards
  'youtube.com', 'youtu.be', 'vimeo.com',
  'googleapis.com', 'gstatic.com', 'cloudflare.com', 'jsdelivr.net',
  'jwplatform.com', 'jwpcdn.com', 'google.com', 'bing.com',
  'cdnjs.cloudflare.com', 'unpkg.com', 'ajax.googleapis.com',
  'fonts.googleapis.com', 'fonts.gstatic.com'
];

// ── Whitelist « clic » (stricte) : liens de confiance à ne jamais intercepter ──
var WFB_CLICK_WHITELIST = [
  'google.com', 'accounts.google.com', 'facebook.com', 'paypal.com',
  'github.com', 'youtube.com', 'vimeo.com', 'dailymotion.com',
  'googleapis.com', 'gstatic.com', 'cloudflare.com', 'jsdelivr.net',
  'stripe.com', 'apple.com', 'microsoft.com'
];

// ── Motifs d'hôtes des lecteurs vidéo (heuristique « popup depuis lecteur ») ──
var WFB_PLAYER_SOURCE_PATTERNS = [
  'smartlink', 'wavewatch', 'bysebuho', 'nzn3', 'viperstream', 'viperstre', 'viper4k',
  'filemoon', 'streamtape', 'dood', 'uqload', 'turbovid',
  'supervideo', 'streamlare', 'player4k', 'embedme', 'embtaku', 'streamvid',
  'mixdrop', 'myviid', 'gounlimited', 'fembed', 'mp4upload', 'cloudvideo'
];

// Nombre de règles statiques embarquées (rules/rules.json) — défaut d'affichage.
var WFB_DEFAULT_RULES_COUNT = 40;
