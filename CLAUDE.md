# Game Library — règles du projet

Ludothèque personnelle (React 19 + Vite, PWA sur GitHub Pages, APK Android par
Capacitor). Le détail des décisions est dans `JOURNAL.md`, la liste de travail
dans `TODO.md`, l'installation dans `README.md`.

## Commandes

- `npm run dev` : serveur de développement.
- `npm run lint` (oxlint) et `npm test` (tests des modules, des scripts et du
  Worker) : à passer avant tout commit.
- `CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run verif:ui` :
  construit, puis mesure l'ergonomie tactile, le contraste, le focus et les
  débordements sur des pages réelles. À passer pour tout changement d'interface.
- L'APK ne se construit pas en local : workflow « Application Android »
  (`android.yml`, déclenché à la main, variante `publication`). `android/` et
  `assets/` sont engendrés et ignorés par git.
- Le Worker se déploie tout seul (`worker.yml`) dès que `worker/**` change sur
  `main`, après ses tests.

## Conventions

- Commentaires en français qui expliquent le **pourquoi** (le défaut rencontré,
  la valeur mesurée), pas ce que la ligne fait.
- Un module de `src/lib/` a son fichier `*.test.mjs` à côté. La logique pure
  vit dans `src/lib/`, ce qui touche au réseau ou au natif reste mince
  (`api.js`, `natif.js`) : c'est ce qui rend la logique testable sans téléphone.
- Couleurs et tailles par jetons CSS (`src/lib/theme.js`, `src/index.css`), jamais
  de valeur écrite en dur : le thème clair doit pouvoir les corriger.
- De vrais `<button>`, jamais de `<div onClick>` (clavier, lecteur d'écran) ;
  cibles tactiles d'au moins 44 × 24 px.
- Un `const` lu avant sa déclaration fait tomber toute l'application sur son
  garde-fou d'erreurs : c'est arrivé trois fois. Déclarer avant d'utiliser.
- Une écriture qui peut échouer (stockage, réseau) doit se voir à l'écran, pas
  se perdre dans un `catch {}` muet.
- Toute donnée venue d'un fichier, du stockage ou de la sauvegarde distante est
  validée comme une entrée non fiable (`validerJeuxImportes`, `preferencesRecues`).

## Façon de travailler

- Branche `claude/…`, commits descriptifs, PR en brouillon, fusion par squash.
- Proposer d'abord, attendre un « ok » explicite avant de modifier quoi que ce
  soit ; ne jamais régénérer un fichier de son propre chef.
- Exporter la bibliothèque avant toute opération destructive.
- Le dépôt reste **public**, et le site GitHub Pages reste en ligne.

## Limites de sécurité

- Jamais de clé dans la conversation ni dans le dépôt : clés d'API saisies dans
  ⚙️ → Services, jeton Cloudflare et clé de signature dans les secrets GitHub.
- Le code de synchronisation est l'unique clé de `/sync` : il vit dans `gl_sync`,
  jamais dans `gl_v2` ni dans l'export.
- Ne jamais commiter un export de bibliothèque, un keystore ou un `.env`.
- Une clé de publication du Play Store se fabrique sur la machine de son
  propriétaire et ne traverse aucune conversation.
