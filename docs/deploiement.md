# Clés, relais et déploiement

Retour au [README](../README.md).

## Pourquoi les clés sont saisies à la main

Une application 100 % statique n'a pas de serveur où cacher un secret : toute clé
embarquée dans le code se retrouverait lisible dans le bundle JavaScript **et**
dans le dépôt public. Les faire saisir par l'utilisateur règle le problème à la
racine — chacun utilise son propre quota, et le dépôt reste sain.

L'**Export JSON contient les jeux mais jamais les clés**, afin qu'une sauvegarde
puisse être partagée ou stockée sans fuite. La synchronisation en ligne peut,
elle, les emporter — mais seulement si l'on coche une case prévue pour, décochée
par défaut (voir [Sauvegarde](#sauvegarde)).

Une fois renseignée, chaque clé passe en **lecture seule** avec un cadenas :
« Modifier » et « Supprimer » sont deux boutons distincts, chacun demandant
confirmation. Ces valeurs n'existent nulle part ailleurs — ni dans l'export, ni
dans le dépôt — et se perdaient d'un doigt qui glisse.

---

## Le relais CORS (Worker Cloudflare)

**SteamGridDB** et **xbl.io** ne renvoient pas d'en-tête
`Access-Control-Allow-Origin` : un navigateur refuse donc de lire leurs réponses,
**même avec une clé valide**. Ce n'est pas un problème d'authentification mais une
règle du navigateur — la clé, où qu'elle soit stockée, n'y change rien.

Le dossier [`worker/`](../worker/) contient un petit relais Cloudflare Worker qui
rétablit ces en-têtes. Points importants :

- **Il ne contient aucun secret.** La clé est envoyée par le client à chaque
  requête et simplement retransmise. Rien à faire tourner, rien à renouveler.
- **Ce n'est pas un proxy ouvert** : double liste blanche, sur les **origines**
  autorisées à l'appeler *et* sur les **cibles** qu'il accepte de relayer
  (uniquement `steamgriddb.com` et `xbl.io`).

### Déploiement (gratuit, ~2 minutes)

```bash
cd worker
npx wrangler login     # compte Cloudflare gratuit, plan Workers gratuit
npx wrangler deploy
```

Wrangler affiche une URL du type `https://game-library-proxy.<compte>.workers.dev`.
La coller dans **⚙️ → Services → « Relais CORS »** → Enregistrer.

> **Relais déjà déployé pour ce projet :**
> `https://game-library-proxy.antoniman31.workers.dev`
> Il suffit de le coller dans ⚙️ sur chaque appareil — inutile de redéployer.

> Sans ce relais, **tout le reste fonctionne** : RAWG, Wikipédia et Wikidata
> autorisent les appels directs. Seuls SteamGridDB et l'import Xbox sont
> indisponibles en ligne.

Si l'application est servie depuis une autre adresse, ajouter celle-ci dans
`ORIGINES` (`worker/index.js`) et redéployer, sinon le navigateur renverra une
erreur CORS.

---

## Déploiement

Deux workflows, deux cibles : le site et le Worker ne vivent pas au même
endroit et ne se publient pas ensemble.

Le site, à chaque push sur `main`
([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)) : `npm ci`,
`npm run lint`, `npm test`, `npm run build`, puis publication de
`dist/` sur GitHub Pages via les actions
officielles `configure-pages` / `upload-pages-artifact` / `deploy-pages`.

**Aucun secret n'est nécessaire pour publier le site** — c'est toute la raison
d'être du choix « clés saisies par l'utilisateur ». Le déploiement du Worker en
demande un seul, `CLOUDFLARE_API_TOKEN`, qui n'autorise que la mise à jour des
Workers du compte et ne donne accès à aucune donnée de l'application.

Le service worker est en `autoUpdate` : une nouvelle version est récupérée
automatiquement au chargement suivant. L'onglet déjà ouvert, lui, continue
d'exécuter l'ancien code — d'où la bannière **« ✨ Nouvelle version »** avec son
bouton Recharger, déclenchée par l'événement `controllerchange`. Sans elle, il
fallait fermer l'application et la rouvrir sans jamais savoir s'il y avait
quelque chose à voir.

**Le Worker se déploie tout seul, par un workflow à part.** GitHub Pages ne
publie que `dist/`, si bien que le Worker se déployait à la main : le code de
`/sync` a passé plusieurs heures dans le dépôt sans jamais atteindre la
production, et l'oubli n'était visible nulle part.
[`.github/workflows/worker.yml`](../.github/workflows/worker.yml) s'en charge
désormais dès que `worker/**` change sur `main` — tests d'abord, déploiement
ensuite. `npx wrangler deploy` ne sert plus qu'à déployer sa propre copie.
