// Relais CORS pour Game Library.
//
// SteamGridDB et xbl.io ne renvoient pas d'en-tête Access-Control-Allow-Origin :
// le navigateur refuse donc de lire leurs réponses, même avec une clé valide.
// Ce Worker se contente de relayer la requête et d'ajouter les en-têtes CORS.
//
// Il ne contient AUCUN secret : la clé est fournie par le client (saisie dans
// l'onglet Réglages de l'app, stockée sur son appareil) et simplement transmise.
// Deux listes blanches le distinguent d'un proxy ouvert :
//   - ORIGINES : qui a le droit de l'appeler
//   - CIBLES   : ce qu'il accepte de relayer

const ORIGINES = [
  "https://antoniman31.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const CIBLES = {
  "/sgdb": "https://www.steamgriddb.com/api/v2",
  "/xbl": "https://xbl.io/api/v2",
};

const corsHeaders = (origine) => ({
  "Access-Control-Allow-Origin": origine,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, X-Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

export default {
  async fetch(request) {
    const origine = request.headers.get("Origin") || "";
    const autorisee = ORIGINES.includes(origine);

    if (request.method === "OPTIONS") {
      return autorisee
        ? new Response(null, { status: 204, headers: corsHeaders(origine) })
        : new Response("Origine non autorisée", { status: 403 });
    }
    if (!autorisee) return new Response("Origine non autorisée", { status: 403 });
    if (request.method !== "GET") return new Response("Méthode non autorisée", { status: 405 });

    const url = new URL(request.url);
    const prefixe = Object.keys(CIBLES).find((p) => url.pathname.startsWith(p + "/"));
    if (!prefixe) {
      return new Response("Cible inconnue", { status: 404, headers: corsHeaders(origine) });
    }

    const cible = CIBLES[prefixe] + url.pathname.slice(prefixe.length) + url.search;

    // On ne transmet que les en-têtes d'authentification, rien d'autre.
    const enTetes = new Headers();
    for (const h of ["Authorization", "X-Authorization"]) {
      const v = request.headers.get(h);
      if (v) enTetes.set(h, v);
    }

    try {
      const reponse = await fetch(cible, { headers: enTetes });
      const sortie = new Headers(corsHeaders(origine));
      const ct = reponse.headers.get("Content-Type");
      if (ct) sortie.set("Content-Type", ct);
      return new Response(reponse.body, { status: reponse.status, headers: sortie });
    } catch {
      return new Response("Erreur de relais", { status: 502, headers: corsHeaders(origine) });
    }
  },
};
