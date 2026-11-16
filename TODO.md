# À faire

Liste de travail courte, pas un journal : voir [`JOURNAL.md`](JOURNAL.md) pour
l'historique des décisions, [`PROGRESS.md`](PROGRESS.md) pour l'état complet
du projet.

## APK : remesurer

Le scan de codes-barres est retiré (16/11/2026), et avec lui ML Kit et CameraX.
Les 11,8 Mo de bibliothèques x86 de la mesure de référence (PR #73, 22,8 Mo)
venaient vraisemblablement de ce module (non mesuré). Le cache Gradle est en place.

- [ ] **Relancer le workflow « Application Android »** (variante `publication`)
      et lire `node scripts/peser-apk.mjs` : s'il reste des bibliothèques natives
      x86, ajouter le filtre d'ABI `arm64-v8a` (décision déjà prise) ; sinon,
      rien à faire. Comparer aussi la durée de la compilation Gradle (3 min 26
      sans cache), à la deuxième construction.

## Depuis l'audit complet du 8 octobre

Rien d'ouvert : `storage.js` et `sync.js` ont leurs tests depuis le 16/11/2026.
