# Game Library — règles du projet

## Règles communes (le même bloc dans tous les dépôts d'Antoni, existants et futurs : le modifier ici, c'est le modifier partout)

Décidées par Antoni le 16/11/2026, mises à jour le 21/11/2026. Les règles propres à ce dépôt suivent ce bloc ; en cas de conflit, ce bloc l'emporte.

- **Avec Antoni** : français, tutoiement, réponses courtes, franches, sans flatterie. Il est seul utilisateur (Galaxy S26 Ultra, PC Windows).
- **Proposer d'abord** : présenter un plan détaillé (étapes, fichiers touchés, approche) et ses propres suggestions d'amélioration, attendre un « ok » explicite avant de toucher quoi que ce soit, ne jamais régénérer un fichier de son propre chef. « Pose des questions » veut dire `AskUserQuestion`, avec des choix concrets et un recommandé. Pour une nouvelle fonctionnalité ou une modification de fonctionnalité ou de design : proposer sans coder, poser des questions si besoin et proposer des visuels (maquette HTML simple sans canvas, ou schéma ASCII).
- **Fusion** : PR en brouillon, fusion par squash **seulement sur le « go » d'Antoni**, CI verte. Jamais de fusion de sa propre initiative, même verte.
- **Branche** : celle que la session impose. Aucun nom de branche n'est écrit dans ce dépôt : l'environnement le change à chaque session.
- **Identité de commit** : `AntoniMan31 <268696974+antoniman31@users.noreply.github.com>`. Jamais l'adresse personnelle d'Antoni : GitHub refuse le push qui l'expose.
- **Noms de modèle** : autorisés (ligne de co-auteur des commits comprise).
- **Secrets** : jamais de clé, de jeton ni de mot de passe dans le dépôt ou la conversation ; ils se saisissent dans l'application ou dans les secrets GitHub/Cloudflare. Jamais d'export de données personnelles ni de `.env` commité.
- **Tests** : le lint et les tests du dépôt passent avant chaque commit. Un test ne compte qu'après l'avoir **vu échouer** sur le code d'avant. Jamais affaiblir un contrôle pour obtenir du vert (test sauté, seuil baissé, exception sans raison écrite).
- **CI, trois niveaux** : *rapide* (lint, tests unitaires, données) à chaque PR ; *lourd* (navigateur, e2e, Windows, compilation Android) seulement si la PR touche autre chose que des `.md`, sinon le job est marqué « sauté », jamais retiré ; *appareil réel* : une PR qui touche l'interface finit par une courte liste « à vérifier sur le S26 ou le PC ». Sur `main`, tout tourne toujours. Une seule CI par PR. Un test qui échoue au hasard a droit à une relance, puis on en cherche la cause.
- **Interface** : de vrais boutons (jamais un `div` cliquable) ; dans une appli utilisée au doigt, **zones tactiles d'au moins 48 px** (48 dp sous Android) ; contraste et focus vérifiés par l'outil du dépôt.
- **Robustesse** : une écriture qui peut échouer (stockage, réseau) se voit à l'écran ; toute donnée venue d'un fichier, du stockage ou du réseau est une entrée non fiable. Exporter les données avant toute opération destructive.
- **Versions et API** : vérifier dans la doc officielle les versions à jour avant d'utiliser une librairie ou une API ; jamais de code déprécié sans le signaler.
- **Contradiction** : si une demande contredit une règle de ce fichier, le signaler avant d'appliquer.
- **Règles à jour** : avant chaque nouvelle tâche, `git fetch origin`, puis relire le bloc « Règles communes » de `CLAUDE.md` sur la branche par défaut (`git show origin/<branche par défaut>:CLAUDE.md`) ; s'il a changé, appliquer la nouvelle version et le dire en une phrase.
- **Écrit** : commentaires en français qui disent **pourquoi** ; aucun chiffre écrit sans l'avoir mesuré ; ne jamais écrire « ça marche » pour ce qui n'a pas tourné sur l'appareil réel.
- **Suivi, trois fichiers à la racine** : `README.md` dit l'**état actuel** ; `JOURNAL.md` garde l'**histoire** (chaque lot s'y ajoute en fin de fichier, sous `### Titre — jj/mm/aaaa`) ; `RESTE-A-FAIRE.md` dit **ce qui reste**, mis à jour à chaque lot. Un fichier de suivi retiré part en entier dans `JOURNAL.md`, sous « Ancien X.md ».

## Règles propres à ce dépôt

Ludothèque personnelle (React 19 + Vite, PWA sur GitHub Pages, APK Android par
Capacitor). L'état et l'installation : `README.md` et `docs/` ; l'histoire et le
détail des décisions : `JOURNAL.md` ; ce qui reste : `RESTE-A-FAIRE.md`.

## Commandes

- `npm run dev` : serveur de développement.
- `npm run lint` (oxlint) et `npm test` (tests des modules, des scripts et du
  Worker) : à passer avant tout commit.
- `CHROMIUM=/opt/pw-browsers/chromium npm run verif:ui` :
  construit, puis mesure l'ergonomie tactile, le contraste, le focus et les
  débordements sur des pages réelles. À passer pour tout changement d'interface ; la CI le joue aussi (job « Interface »,
  sauté sur une PR qui ne touche que des `.md`).
- L'APK ne se construit pas en local : workflow « Application Android »
  (`android.yml`, déclenché à la main, variante `publication`). `android/` et
  `assets/` sont engendrés et ignorés par git.
- Le Worker se déploie tout seul (`worker.yml`) dès que `worker/**` change sur
  `main`, après ses tests.

## Conventions

- Les commentaires disent le défaut rencontré et la valeur mesurée.
- Un module de `src/lib/` a son fichier `*.test.mjs` à côté. La logique pure
  vit dans `src/lib/`, ce qui touche au réseau ou au natif reste mince
  (`api.js`, `natif.js`) : c'est ce qui rend la logique testable sans téléphone.
- Couleurs et tailles par jetons CSS (`src/lib/theme.js`, `src/index.css`), jamais
  de valeur écrite en dur : le thème clair doit pouvoir les corriger.
- Cibles tactiles : 48 px de haut (jetons `--tap` et `--tap-min`), 24 px de large
  au moins pour une commande en ligne ; `verif:ui` mesure les deux.
- Un `const` lu avant sa déclaration fait tomber toute l'application sur son
  garde-fou d'erreurs : c'est arrivé trois fois. Déclarer avant d'utiliser.
- La CSP du site est écrite à la construction par `src/lib/csp.js` (empreinte du script du thème recalculée à chaque
  build) ; `verif:ui` échoue sur tout refus de la CSP. Pas de CSP dans l'APK (`--mode android`).
- La sauvegarde distante est une entrée non fiable comme un fichier :
  `validerJeuxImportes`, `preferencesRecues`.

## Façon de travailler

- Commits descriptifs.
- Le dépôt reste **public**, et le site GitHub Pages reste en ligne.

## Limites de sécurité

- Les clés d'API se saisissent dans ⚙️ → Services ; le jeton Cloudflare et la clé
  de signature vivent dans les secrets GitHub.
- Le code de synchronisation est l'unique clé de `/sync` : il vit dans `gl_sync`,
  jamais dans `gl_v2` ni dans l'export.
- Ne jamais commiter un keystore.
- Une clé de publication du Play Store se fabrique sur la machine de son
  propriétaire et ne traverse aucune conversation.
