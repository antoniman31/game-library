# À faire

Liste de travail courte, pas un journal : voir [`JOURNAL.md`](JOURNAL.md) pour
l'historique des décisions, [`PROGRESS.md`](PROGRESS.md) pour l'état complet
du projet.

## Optimisations APK — en attente du test de scan

Mesure de référence (PR #73, `node scripts/peser-apk.mjs`) : l'APK de
publication pèse 22,8 Mo, dont 11,8 Mo (52 %) d'architectures natives qui ne
servent qu'à l'émulateur Android (x86 6,0 Mo, x86_64 5,7 Mo) — aucun
téléphone réel ne les utilise.

- [ ] **Limiter l'APK à `arm64-v8a` seul.** Ajoute un filtre d'ABI dans le
      `build.gradle` engendré (même mécanisme que
      `scripts/publication-android.mjs`). Gain attendu : environ la moitié
      de la taille actuelle. Décision prise : arm64 seul, sans
      `armeabi-v7a` (couvre tous les téléphones vendus depuis ~2017).
- [ ] **Client ML Kit « non empaqueté » pour le scan de codes-barres.** Le
      modèle de reconnaissance est aujourd'hui livré dans l'APK ; la version
      « unbundled » le télécharge une fois depuis Play Services au lieu de
      le porter à chaque mise à jour. Gain plus modeste que l'ABI, mais réel.

**Bloqué par :** le test du scan de codes-barres sur les trois boîtes
physiques annoncé par Antoni — ni fait ni invalidé à ce jour. Les deux
chantiers touchent au module qui scanne, donc ils attendent sa confirmation
que la fonctionnalité marche sur du matériel réel avant d'y toucher.

## Prêt à faire, indépendant du reste

- [ ] **Cache Gradle dans `.github/workflows/android.yml`.** Chaque
      construction Android repart de zéro : la seule étape de compilation
      Gradle prend à elle seule 3 min 26 sur la dernière mesure, sans qu'aucune
      dépendance ne soit mise en cache d'une construction à l'autre. Aucun
      risque fonctionnel, à faire quand on veut.

## Depuis l'audit complet du 8 octobre

Rien de grave : ni faille, ni bug, ni code mort trouvé dans l'ensemble du
projet (lib, composants, Worker, scripts, CI). Deux constats réels, tous
deux sans urgence.

- [ ] **`README.md` et `PROGRESS.md` ont deux semaines de retard sur le
      code.** Les deux décrivent encore l'accordéon « 🔗 Liens & contenu »
      (supprimé en PR #76) comme s'il existait. `README.md` ligne 172 dit que
      la recherche porte sur « titre + genre + tag » — le champ `tag` est
      retiré du modèle, la recherche ne porte plus que sur titre et genre.
      `PROGRESS.md` est daté du 4 septembre, annonce « 88 tests » (289
      aujourd'hui), et ne mentionne ni les graphiques de Stats (PR #78), ni
      ce fichier, ni la décision de garder le site secondaire à l'APK.
      `JOURNAL.md` n'est pas concerné : c'est un historique assumé, ses
      mentions passées sont normales.
- [ ] **`storage.js` et `sync.js` n'ont pas de test dédié**, alors qu'ils
      portent une vraie logique de branchement (quel message afficher selon
      le type d'erreur de stockage ; comment interpréter un 404/409/autre du
      relais) — presque tous les autres modules de `src/lib/` en ont un,
      y compris des modules plus petits qu'eux.
