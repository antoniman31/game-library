# Architecture et choix techniques

Retour au [README](../README.md).

## D'un seul fichier à un découpage

Le projet est né d'un artefact autonome et a grandi par ajouts successifs : tout
vivait dans `src/App.jsx`, 1 560 lignes et 136 Ko, styles inline compris. Ça a
tenu longtemps, puis chaque ajout est devenu plus coûteux que le précédent et
une erreur ne se cherchait plus qu'à l'aveugle.

Le code est désormais réparti entre `src/lib/` (réseau, domaine, stockage,
synchronisation) et `src/components/`, et `App.jsx` ne garde que l'ossature.

Les couleurs, elles, ont quitté le JavaScript. Chaque composant recevait une
prop `dark` et recalculait ses teintes dans des styles inline
(`dark ? "#1a1a2e" : "#f0f4ff"`, une quarantaine de fois). Tant que rien ne
passait par une feuille de style, aucune media query, aucun `:hover` et aucun
mode d'affichage n'étaient possibles. Elles sont maintenant des jetons CSS dans
`src/index.css`, basculés par un attribut `data-theme` sur `<html>`.

## Où sont passées les traductions automatiques ?

Les descriptions ont d'abord été traduites de l'anglais via l'API MyMemory
(gratuite, 500 caractères par requête, avec découpage en segments et recollage).
Cette approche a été **entièrement retirée** au profit de **Wikipédia FR**, qui
fournit directement un texte français rédigé, sans quota ni découpage.

## Décisions notables

- **Le lint distingue le navigateur du Worker.** `no-undef` est actif, et
  l'environnement Node est déclaré dans un `overrides` limité à `worker/**`
  plutôt que globalement. Déclaré partout, il rendrait `process` défini dans
  `src/` aussi : un `process.env.X` glissé dans le code navigateur passerait le
  lint pour échouer à l'exécution, Vite ne fournissant pas `process` au
  navigateur. Attention au nom du fichier : oxlint ne lit que `.oxlintrc.json`,
  avec le point ; un `oxlintrc.json` sans point est ignoré en silence.
- **La CI tourne sur les pull requests**, le job `deploy` restant réservé à
  `main`. Le workflow ne se déclenchait que sur un push vers `main` : lint et
  build ne s'exécutaient donc qu'après la fusion, au moment où ils déploient
  déjà. Une pull request qui ne compilait pas n'était visible qu'une fois le
  site cassé.
- **`npm ci` en CI.** Le lockfile échouait autrefois à la validation stricte
  parce qu'il lui manquait les binaires natifs Linux de Rollup, absents quand il
  était généré sous Windows. Il les porte désormais, et le workflow est repassé
  à `npm ci` : `npm install` laissait npm résoudre librement, donc une version
  mineure d'une dépendance transitive pouvait casser un déploiement sans qu'un
  seul commit touche au projet. Si tu installes sous Windows, npm ajoutera les
  binaires win32 : commite le lockfile mis à jour, il portera alors les deux
  plateformes.
- **Le sombre est un vrai noir.** Le noir profond a d'abord été une préférence
  applicable par-dessus un sombre bleu nuit, ce qui faisait quatre commandes
  dans un panneau qui en comptait déjà trois pour la même question — et pour un
  choix qui n'en est pas un : entre un bleu nuit et un vrai noir, on tranche une
  fois. Sur une dalle OLED, un pixel noir est un pixel éteint. Les cartes ne
  sont pas noires elles aussi, sinon plus rien ne se distingue : ce sont les
  bordures, remontées, qui portent la structure.
- **Les gestes irréversibles demandent confirmation, en disant ce qu'ils
  coûtent.** Supprimer un jeu emporte son historique de prêts et le retour
  arrière ne dure que cinq secondes ; effacer une clé nomme le service qui
  cessera de fonctionner ; remplacer le code de synchronisation rend
  inaccessible la sauvegarde qu'il protégeait, ce qui ne se voit pas tout de
  suite. Ces messages vivent dans `src/lib/garde-fous.js`, purs et testés :
  c'est le genre de garde-fou qu'on écrit une fois et qu'on ne relit jamais,
  jusqu'au jour où il ne se déclenche pas.
- **Ce que l'application ne fait pas.** Elle a longtemps suivi la progression
  (non commencé, en cours, terminé, platine, abandonné) et le temps de jeu, avec
  chronomètre et historique de sessions. Les deux ont été retirés : la console
  tient déjà ces données, mieux et sans saisie manuelle. Les redoubler ici
  demandait du travail pour une information qu'on possède ailleurs. Il reste ce
  que la console ne sait pas faire — voir toute la bibliothèque d'un coup, et
  savoir chez qui sont les jeux.
- **Ce qui est écrit deux fois est surveillé.** Le script anti-clignotement
  d'`index.html` réécrit à la main la logique de `resoudreTheme()` et les
  couleurs de barre système — il le doit, il s'exécute avant que le bundle
  existe. Rien n'obligeait ces deux copies à rester d'accord : une couleur de
  fond changée d'un côté et oubliée de l'autre, et la barre d'état affiche
  l'ancienne teinte le temps du chargement, ce que personne ne signale jamais.
  `coherence.test.mjs` exécute le script inline dans un contexte minimal et
  compare son verdict à celui du module, pour toutes les valeurs possibles. Il
  vérifie aussi que chaque jeton nommé par `theme.js` est défini dans les deux
  thèmes. L'idée vient du `check_sources_sync.py` d'un autre projet, écrit après
  qu'une divergence du même genre soit restée invisible plusieurs semaines.
- **Les couleurs sont des jetons, y compris l'accent.** Le bleu était écrit en
  dur une cinquantaine de fois dans le JavaScript ; le jeton `--accent` existait
  mais ne servait à rien, si bien que le thème clair ne pouvait pas le corriger.
  Or sur fond clair il ne donnait que 2,58:1 alors que WCAG AA demande 4,5:1 —
  et c'est la couleur de presque tout le petit texte cliquable. Le thème clair
  le remonte désormais à 5,75:1 ; le sombre garde exactement la même teinte.
- **Le mobile d'abord.** L'en-tête collant empilait le titre, cinq boutons à
  libellé complet, les onglets, la recherche et quatre rangées de puces de
  filtres : 317 px sur un écran de 915, soit un tiers de la surface avant le
  premier jeu, et une rangée de boutons qui débordait de 13 px et faisait
  défiler la page latéralement. Filtres et actions sont passés dans des
  panneaux glissants. La liste a longtemps été paginée par 30, jusqu'à ce que la
  mesure montre que tout monter d'un coup ne coûte qu'une seconde de plus au
  démarrage sur un vieux téléphone : le bouton « Charger 30 de plus » a disparu
  et la bibliothèque s'affiche entière. La bibliothèque a depuis presque doublé,
  et la mesure a été refaite sur les 288 jeux réels : `content-visibility: auto`
  sur les fiches et `loading="lazy"` sur les jaquettes ramènent la liste complète
  de 2 471 à 1 727 ms sur un processeur ralenti six fois, et le pire cas — effacer
  la recherche pour faire revenir toute la liste — de 880 à 711 ms. Les cibles principales, longtemps à 44 px « pour ne pas faire
  exploser la densité », sont passées à 48 — le chiffre de Material — après
  qu'un audit a montré que le compromis avait été fait avec nous-mêmes et non
  avec l'utilisateur. Les commandes secondaires restent à 44 : c'est le plancher
  d'Apple et de WCAG 2.5.8, et les passer à 48 reflowerait tous les panneaux
  pour quatre pixels.
- **Les panneaux sont rendus à la racine du document.** `position: fixed` n'est fixe
  que tant qu'aucun ancêtre ne crée de bloc conteneur, et `content-visibility: auto`
  — posé sur les fiches pour ne pas dessiner celles qui sont hors écran — en crée un.
  Les cinq panneaux d'une fiche s'en sont trouvés enfermés dans leur fiche : mesurés à
  360×904 positionnés à −225 au lieu de 390×800, avec 1846 px de contenu à faire tenir
  dans une fenêtre de 153 px. Une fiche qu'on ne pouvait plus modifier. Un portail les
  sort du sous-arbre, ce qui est de toute façon la place d'un dialogue modal, et
  `verif:ui` signale désormais tout élément fixe qu'un ancêtre confine — la règle
  nomme la cause, parce que ce défaut n'a de symptôme qu'à l'usage.
- **Rien n'échoue plus en silence.** Une exception de rendu vidait `#root` sans
  un mot ; un `ErrorBoundary` affiche désormais l'erreur et propose d'exporter
  la bibliothèque avant toute chose. Les écritures dans `localStorage` étaient
  enveloppées dans un `catch {}` muet : un quota saturé faisait perdre la
  persistance sans le moindre signe.
- **Déploiement par artefact**, pas de dossier `docs/` commité : aucun fichier
  généré n'entre dans le dépôt.
- **`addedDate` sert de proxy de date de sortie** pour classer Xbox One /
  Series X. C'est approximatif pour quelques titres anciens (Halo 4, sorti en
  2012 sur Xbox 360, se retrouve classé Xbox One) — assumé pour rester simple.
- **Le service worker ne met jamais les appels d'API en cache**, uniquement la
  coquille de l'application et les jaquettes distantes : les données doivent
  rester fraîches et échouer proprement hors ligne.
- **Les jaquettes xbl.io sont réécrites en HTTPS.** L'API les renvoie en `http://`
  (bloquées en contenu mixte sur un site HTTPS), et une partie vient de
  `images-eds.xboxlive.com`, hôte qui ne répond pas en TLS — un simple passage en
  `https` échouait donc aussi. Le helper `httpsImage` bascule vers l'hôte
  `images-eds-ssl` équivalent avant de forcer le schéma. Bug invisible en
  développement, où la page est servie en `http://localhost`.
- **Historique git purgé avant la première publication.** Les clés avaient été
  committées pendant le développement local ; elles ont été retirées de tous les
  commits avec `git-filter-repo` **avant** le premier push. Elles ne sont donc
  jamais sorties de la machine de développement.

## Performance mesurée

**Toute la bibliothèque est montée d'un coup.** Mesuré sur 155 jeux et la
version construite, cela coûte 0,2 s de plus au démarrage sur une machine de
bureau, 0,7 sur un téléphone récent et 1,1 sur un ancien. À bibliothèque
doublée, la question se repose : les chiffres sont en commentaire dans
`App.jsx` pour qu'on n'ait pas à les redécouvrir. Elle l'est depuis — 288 jeux
au 15/09/2026 —, et l'application reste fluide sur le téléphone d'Antoni,
lancement et défilement compris. Ces trois durées n'ont pas été remesurées pour
autant : elles disent pourquoi la pagination a été retirée, pas ce que coûte la
bibliothèque d'aujourd'hui.

## Structure du dépôt

```
├── .github/workflows/
│   ├── deploy.yml        Lint, tests, build, publication GitHub Pages
│   ├── worker.yml        Tests puis déploiement du Worker (dès que worker/** change)
│   └── android.yml       APK à la demande (publication ou débogage)
├── worker/               Relais CORS + sauvegarde en ligne, sans secret (index.js, test.mjs, wrangler.toml)
├── scripts/              Audit, dates suspectes, mesure de l'APK, génération Android, verif-ui
├── public/               Icônes PWA, favicon
├── src/
│   ├── App.jsx           Ossature : état global, en-tête, onglets
│   ├── main.jsx          Montage + garde-fou d'erreurs global
│   ├── index.css         Jetons : couleurs, cibles tactiles, typographie, formes
│   ├── lib/              Logique pure, un fichier *.test.mjs à côté de chaque module
│   │                     (api.js et natif.js restent minces : réseau et natif)
│   └── components/       Fiches, modales, panneaux, statistiques, réglages
├── index.html            Script anti-clignotement du thème
├── vite.config.js        Base, PWA, proxys de développement, mode android
├── capacitor.config.json
├── CLAUDE.md             Règles de travail du projet
├── TODO.md               Liste de travail courte
├── PROGRESS.md           État des fonctionnalités
└── JOURNAL.md            Journal : décisions, bugs, impasses
```

`android/` et `assets/` sont engendrés par `npm run android` et ignorés par git.
