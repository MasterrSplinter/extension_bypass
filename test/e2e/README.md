# Tests e2e (extension chargée dans un vrai Chromium)

Ces tests lancent **Chromium avec l'extension `dist/chrome` chargée** et vérifient
le blocage in-page sur un site de streaming simulé.

## Principe

`--host-resolver-rules=MAP anime-sama.fr 127.0.0.1` fait croire au navigateur que
la fixture locale (`fixtures/streaming.html`) est servie depuis `anime-sama.fr`.
Les `content_scripts` s'injectent donc comme en conditions réelles (sans toucher
à un vrai site), et on peut asserter que la pub est supprimée.

## Lancer en local

```bash
npm run build          # génère dist/chrome
npx playwright install chromium   # une seule fois
xvfb-run -a npm run test:e2e      # Linux sans affichage ; sinon: npm run test:e2e
```

> Le chargement d'une extension impose un Chromium **non-headless** (`headless: false`).
> Sous Linux sans écran, on l'enveloppe avec `xvfb-run` (un display virtuel).

## Ajouter un cas

- Étendre `fixtures/streaming.html` avec l'élément pub à neutraliser.
- Ajouter un `test(...)` dans `extension.spec.mjs`.
- Pour tester un autre hôte protégé, l'ajouter au `--host-resolver-rules`.
