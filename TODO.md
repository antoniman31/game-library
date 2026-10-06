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
