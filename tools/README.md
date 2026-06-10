# Outils de développement

## `inspect.mjs` — inspection live d'un site réel

Pilote un vrai Chromium avec l'extension `dist/chrome` chargée, navigue vers une
URL réelle et rapporte : URL finale, titre, texte, **iframes**, éléments
**pub/overlay candidats** (avec `outerHTML`), **logs de console** (dont ceux de
l'extension) et une **capture** dans `/tmp/inspect.png`.

```bash
npm run build                       # génère dist/chrome
npx playwright install chromium     # une seule fois
xvfb-run -a node tools/inspect.mjs https://exemple-site.tld/ 8000
#                                    ^URL                     ^ms d'attente
```

> Sous Linux sans écran, on enveloppe avec `xvfb-run` (le chargement d'extension
> impose un Chromium non-headless). En dehors de ce cas, `node tools/inspect.mjs …`.

### Notes réseau (environnements proxifiés)
Le script passe `--disable-quic` (UDP/HTTP3 souvent filtré) et
`--ignore-certificate-errors` (proxy d'egress qui intercepte le TLS). Sans ces
options, on obtient `ERR_QUIC_PROTOCOL_ERROR` ou `ERR_CERT_AUTHORITY_INVALID`.

### À quoi ça sert
Voir la **vraie** structure d'un site (classes/ID réels des pubs, type de lecteur,
overlays d'étapes, redirections) pour écrire des sélecteurs/bypass justes, puis
valider le correctif — au lieu de deviner avec des fixtures synthétiques.
