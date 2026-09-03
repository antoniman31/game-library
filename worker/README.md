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

## Sauvegarde et synchronisation (`/sync`)

La bibliothèque ne vivait que dans le `localStorage` d'un navigateur : un
stockage par appareil, sans pont entre le téléphone et le PC, et effacé avec
les données de site. Le Worker peut désormais la déposer dans un espace KV.

```bash
npx wrangler kv namespace create SYNC
```

Recopier l'identifiant renvoyé dans `wrangler.toml` (décommenter le bloc
`[[kv_namespaces]]`), puis `npx wrangler deploy`.

Tant que l'espace n'est pas configuré, le relais CORS continue de fonctionner
normalement et `/sync` répond `501` avec un message explicite.

### Comment ça marche

- `PUT /sync` avec l'en-tête `X-Sync-Code` et un corps `{"games": [...]}`
  enregistre la bibliothèque. L'horodatage est posé par le serveur : l'horloge
  d'un appareil peut être fausse, et c'est lui qui arbitre qui est le plus
  récent.
- `GET /sync` avec le même en-tête la rend.

**Le code de synchronisation est le seul secret.** Qui le détient lit et écrit
la bibliothèque. Il est généré par l'application (26 caractères aléatoires),
reste sur l'appareil, ne figure pas dans l'export JSON, et voyage dans un
en-tête plutôt que dans l'URL — les chemins finissent dans les journaux. C'est
son empreinte SHA-256, et non lui, qui sert de clé KV : la liste des clés
visible dans le tableau de bord Cloudflare ne doit pas être une liste de mots
de passe.

### Ce que ça ne protège pas

La liste blanche d'origines se fonde sur l'en-tête `Origin`, qu'un navigateur
tiers respecte mais qu'un `curl` peut inventer. Elle empêche un autre site
d'appeler ce Worker depuis le navigateur d'un visiteur ; elle n'empêche pas un
appel direct. Sans le code, un tel appel ne peut ni lire ni écrire une
sauvegarde existante — au pire il en crée sous des codes inventés, ce que
plafonnent la taille maximale (2 Mo) et les quotas du compte.
