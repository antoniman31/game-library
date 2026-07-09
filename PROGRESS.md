# Game Library — État du projet

Application de gestion de bibliothèque de jeux vidéo (Xbox / Switch), usage perso.
Dernière mise à jour : 2026-07-09.

## Stack & lancement

- **Vite + React** (React 19, Vite 8), projet **100 % local** (aucun backend).
- Point d'entrée : `src/App.jsx` (tout le code y est — composant unique, styles inline).
- Persistance : **localStorage** (clé `gl_v2`).
- Démarrer le dev :
  ```bash
  npm install   # première fois
  npm run dev   # http://localhost:5173
  ```
- Build de prod : `npm run build`.

## Fonctionnalités livrées

### RAWG (base de données de jeux)
- **Autocomplete à l'ajout** (`AddModal`) : recherche par titre, jaquette + date + Metacritic dans les suggestions.
- **Fetch auto au démarrage** : récupère covers + Metacritic manquants pour les jeux sans jaquette.
- **Bouton correction par jeu** « 🔄 Rechercher sur RAWG » (dans la fiche dépliée) : ré-associe un jeu mal matché → remplace cover, Metacritic, genres et description. Liste de suggestions scrollable (jusqu'à 10 résultats).
- Clé API RAWG utilisée : `CLE_RAWG_RETIREE_DE_L_HISTORIQUE`.

### Suivi de jeu
- **Chrono de session** : bouton Jouer/Stop, cumule le temps joué.
- **Temps manuel** : saisie h/min avec boutons **+** (ajouter) et **−** (retirer, borné à 0).
- **Barre HowLongToBeat** : progression `% HLtB` si le champ `hltb` du jeu est renseigné.
- **Historique des 3 dernières sessions** par jeu.

### Prêts
- Marquer un jeu comme prêté (nom + date), passe le statut à « prêté ».
- Onglet **Prêts** : liste des jeux prêtés, **alerte visuelle si prêt > 30 jours** (« ⚠️ Prêt long ! »), bouton **SMS** (lien `sms:` pré-rempli pour relancer l'emprunteur).

### Organisation & UI
- **Stats** : total, terminés, en cours, prêtés, temps total, top genres.
- **Tri** : A-Z / Date / Metacritic / Temps.
- **Filtres** : plateforme + statut, recherche texte (titre / genre / description).
- **Vues** : liste et grille.
- **Thème clair / sombre**.
- **Suppression de jeu** avec confirmation (`window.confirm`).
- **Fiches en accordéons** repliés par défaut : « 📤 Prêt », « 🔗 Liens & contenu », « 📝 Notes ». Toujours visibles hors accordéon : genres, statut, bloc Temps de jeu. Description repliée à 2 lignes avec toggle « Lire la suite ».
- **Retirés de l'UI** (mais champs `note` / `tag` / `progression` conservés dans le modèle de données pour compat) : note /10, tag, progression.

### Traduction FR des descriptions
- Traduction des descriptions RAWG (anglais → français) via **l'API MyMemory** (gratuite, sans clé).
- **Découpage en segments ≤ 500 caractères** (coupe sur fin de phrase) car MyMemory limite chaque requête à 500 car. ; segments traduits séquentiellement (150 ms entre appels) puis recollés.
- Fallback sur l'anglais brut non tronqué si un appel échoue.
- **Bouton « 🌐 Actualiser descriptions »** (header) : relance la traduction sur toute la bibliothèque, avec **progression** (« X/94 traduits ») et bouton désactivé pendant l'opération.

## Limite connue

- **MyMemory** : environ **5 000 mots/jour** en anonyme (par IP). Au-delà, les appels échouent → les jeux concernés retombent en anglais (sans planter). Pour un usage intensif : proxy backend + clé, ou LLM côté serveur.

## Prochaine étape

- **Déploiement en PWA** (Vercel ou Netlify) pour un accès mobile pratique.
  - Ajouter un manifest + service worker (installable sur écran d'accueil).
  - Vérifier que localStorage suffit ou prévoir une synchro si multi-appareils.

## Structure

```
GameLibrary/
├── index.html
├── package.json
├── vite.config.js
├── PROGRESS.md          ← ce fichier
└── src/
    ├── App.jsx          ← toute l'application
    ├── main.jsx
    └── index.css
```
