# Relais CORS — Game Library

SteamGridDB et xbl.io n'autorisent pas les appels directs depuis un navigateur
(pas d'en-tête CORS). Ce Worker relaie ces deux API en ajoutant les en-têtes
manquants.

**Il ne contient aucune clé.** Chaque utilisateur saisit les siennes dans
l'onglet ⚙️ de l'application ; elles sont stockées sur son appareil et
transmises à chaque requête.

## Déploiement

```bash
cd worker
npx wrangler login      # ouvre le navigateur, compte Cloudflare gratuit
npx wrangler deploy
```

Wrangler affiche une URL du type `https://game-library-proxy.<compte>.workers.dev`.
Coller cette URL dans l'application : onglet ⚙️ → « Relais CORS » → Enregistrer.

## Ajouter une origine

Si l'application est servie depuis une autre adresse, ajouter celle-ci dans
`ORIGINES` (dans `index.js`) puis redéployer. Sans cela, le navigateur renverra
une erreur CORS.
