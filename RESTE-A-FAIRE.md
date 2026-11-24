# Ce qui reste à faire

Liste de travail courte, pas un journal : voir [`JOURNAL.md`](JOURNAL.md) pour
l'historique des décisions, [`README.md`](README.md) et `docs/` pour l'état
du projet. (Anciennement `TODO.md`, renommé le 16/11/2026.)

## Audit design du 21/11/2026

- Fait : le contraste est mesuré par `src/lib/contraste.test.mjs` (toutes les paires à 4,5:1 ou plus).
- Fait : les couleurs écrites en dur sont passées en jetons (`src/lib/couleurs.test.mjs` refuse d'en réécrire une).
- Vérifié sur le S26 par Antoni le 24/11/2026 : rendu identique dans les deux thèmes, badge « prêté à » lisible en clair.

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

## À vérifier par Antoni (repris de l'ancien PROGRESS.md du 04/11/2026)

- [ ] **Hors ligne et mise à jour du site (21/11/2026)** : vite-plugin-pwa est passé de 1 à 2 (#90). Ouvrir le site
      connecté, puis en mode avion : il s'affiche ; après une nouvelle version, la bannière de mise à jour apparaît.
- [ ] **Reconstruire l'APK** (workflow « Application Android ») : Capacitor 8.6 et @capacitor/assets 4 (#90) n'y sont
      pas encore passés ; l'installer et vérifier le démarrage, le bouton Retour et le partage.

- [ ] **CSP du site (16/11/2026)** : ouvrir le site sur le S26 et sur le PC, puis vérifier que jaquettes, recherche,
      synchronisation et services s'affichent comme avant ; un refus de la CSP casserait une fonction sans message.

- [ ] **Rendre sa série à *Plague Inc: Evolved*** si elle manque : la fausse série
      « Inc. » est écartée à la lecture, et rien ne la reprend toute seule.
      « Plague Inc. » se saisit à la main sur la fiche.
- [ ] **Bouton Retour de l'application Android** : corrigé (un seul écouteur, qui
      referme ce qui est au premier plan ou quitte), jamais essayé sur l'appareil.

