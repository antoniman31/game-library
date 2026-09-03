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

## Déploiement

Le Worker se déploie tout seul quand `worker/` change sur `main`, via
[`.github/workflows/worker.yml`](../.github/workflows/worker.yml). Les tests
tournent avant : un Worker cassé en production couperait à la fois la
synchronisation et le relais des jaquettes.

Un seul secret est nécessaire dans le dépôt GitHub (Settings → Secrets and
variables → Actions) : **`CLOUDFLARE_API_TOKEN`**, créé depuis Cloudflare
(Mon profil → Jetons d'API → modèle « Modifier les Workers Cloudflare »).
L'identifiant de compte, lui, est dans `wrangler.toml` : il figure dans l'URL
du tableau de bord et n'est pas un secret.

Il se déploie aussi à la main depuis l'onglet Actions du dépôt
(« Déploiement du Worker » → Run workflow), ou en local :

```bash
cd worker
npx wrangler login
npx wrangler deploy
```

Cette automatisation répond à un incident concret : le code de `/sync` est
resté plusieurs heures dans le dépôt sans jamais atteindre la production,
parce que personne n'avait relancé `wrangler deploy` — et rien ne le signalait.

## Sauvegarde et synchronisation (`/sync`)

La bibliothèque ne vivait que dans le `localStorage` d'un navigateur : un
stockage par appareil, sans pont entre le téléphone et le PC, et effacé avec
les données de site. Le Worker la dépose dans l'espace KV `SYNC`, déclaré dans
`wrangler.toml`.

Tant qu'aucun espace KV n'est lié, le relais CORS continue de fonctionner
normalement et `/sync` répond `501` avec un message explicite.

### Comment ça marche

- `PUT /sync` avec l'en-tête `X-Sync-Code` et un corps `{"games": [...]}`
  enregistre la bibliothèque. L'horodatage est posé par le serveur : l'horloge
  d'un appareil peut être fausse, et c'est lui qui arbitre qui est le plus
  récent.
- `GET /sync` avec le même en-tête la rend.
- `X-Sync-Base` porte l'horodatage de la sauvegarde que l'appareil a vue en
  dernier. S'il ne correspond plus à celle du relais, le Worker répond `409`
  avec l'état courant plutôt que d'écraser le travail d'un autre appareil en
  silence. `X-Sync-Base: force` passe outre, mais l'application ne l'envoie
  qu'après une confirmation explicite de l'utilisateur.

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
