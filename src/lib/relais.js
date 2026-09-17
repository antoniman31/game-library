// Le relais, et comment s'en passer.
//
// Trois services ne renvoient pas d'en-tête CORS — SteamGridDB, xbl.io et le
// magasin Steam. Un navigateur refuse donc de lire leur réponse, et le projet
// a un Worker Cloudflare qui ne fait rien d'autre que redemander la même chose
// depuis un endroit où la règle ne s'applique pas.
//
// Cette règle est une règle de navigateur. Une application installée n'est pas
// un navigateur : elle fait ses requêtes depuis le code natif, où il n'y a ni
// origine ni CORS. Le détour n'a plus de raison d'être, et le supprimer
// supprime avec lui une adresse à saisir, un service à maintenir, une panne
// possible et un intermédiaire qui voit passer les clés.
//
// Ce que ça ne supprime pas, et il faut le dire : la synchronisation. `/sync`
// n'est pas un relais, c'est un espace de stockage — sans Worker, il n'y a
// rien à joindre. Qui sauvegarde en ligne garde le sien.
//
// Ici, uniquement la table de correspondance et sa règle, sans rien de natif :
// c'est ce qui permet de la tester.

export const CIBLES = {
  "/sgdb": "https://www.steamgriddb.com/api/v2",
  "/xbl": "https://xbl.io/api/v2",
  "/steam": "https://store.steampowered.com/api",
};

// Le chemin relayé, rendu à sa vraie adresse. Null si ce n'est pas un chemin
// relayé : l'appelant se débrouille, plutôt que de recevoir une URL inventée.
//
// Le préfixe doit être suivi d'une barre : sans cette précaution, un futur
// `/steamdb` partirait chez Steam avec `db` collé devant son chemin.
export function adresseDirecte(chemin) {
  const c = String(chemin || "");
  const prefixe = Object.keys(CIBLES).find(p => c === p || c.startsWith(p + "/"));
  return prefixe ? CIBLES[prefixe] + c.slice(prefixe.length) : null;
}

// L'adresse à appeler, selon l'endroit d'où l'on appelle.
//
// Web : le relais, et sans relais configuré les chemins relatifs — c'est le
// proxy du serveur de développement de Vite, qui joue le même rôle.
// Natif : la source, directement.
export function adresseAppel(chemin, { natif, proxy } = {}) {
  if (natif) {
    const directe = adresseDirecte(chemin);
    if (directe) return directe;
  }
  return String(proxy || "").replace(/\/+$/, "") + chemin;
}
