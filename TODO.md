# À faire

Liste de travail courte, pas un journal : voir [`JOURNAL.md`](JOURNAL.md) pour
l'historique des décisions, [`PROGRESS.md`](PROGRESS.md) pour l'état complet
du projet.

## APK : mesuré, rien à faire

Construction de publication n° 21 (16/11/2026, après le retrait du scan), lue par
`scripts/peser-apk.mjs` : **1 333 Ko** au lieu de 22,8 Mo (PR #73). Ressources
Android 611 Ko, code dex 475 Ko, application web 219 Ko, **aucune bibliothèque
native** : les 11,8 Mo de x86 venaient du module de scan. Le filtre d'ABI
`arm64-v8a` n'a plus d'objet. Compilation Gradle : 1 min 52 sans cache (3 min 26
avant, ML Kit compris) ; le cache est enregistré, la prochaine construction dira
ce qu'il fait gagner.

## Depuis l'audit complet du 8 octobre

Rien d'ouvert : `storage.js` et `sync.js` ont leurs tests depuis le 16/11/2026.
