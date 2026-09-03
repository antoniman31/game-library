// Worker Game Library : relais CORS + sauvegarde de la bibliothèque.
//
// 1. RELAIS — SteamGridDB et xbl.io ne renvoient pas d'en-tête
//    Access-Control-Allow-Origin : le navigateur refuse de lire leurs réponses,
//    même avec une clé valide. Le Worker relaie la requête et ajoute les
//    en-têtes CORS. Il ne détient AUCUN secret : la clé est fournie par le
//    client (onglet Réglages, stockée sur son appareil) et simplement transmise.
//
// 2. SAUVEGARDE — la bibliothèque ne vivait que dans le `localStorage` d'un
//    navigateur : un stockage par appareil, sans pont entre le téléphone et le
//    PC, et perdu avec les données de site. `/sync` la dépose dans un espace
//    KV et la rend, ce qui donne à la fois une sauvegarde hors appareil et une
//    bibliothèque commune à tous les appareils.
//
// Deux listes blanches distinguent le relais d'un proxy ouvert :
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

// Plafond de la sauvegarde. Une bibliothèque de 100 jeux avec descriptions pèse
// environ 150 Ko ; 2 Mo laissent de la marge sans faire de l'espace KV un
// hébergement de fichiers.
const TAILLE_MAX = 2 * 1024 * 1024;

const corsHeaders = (origine) => ({
  "Access-Control-Allow-Origin": origine,
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, X-Authorization, X-Sync-Code, Content-Type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

// Le code de synchronisation est le seul secret : quiconque le détient lit et
// écrit la bibliothèque. Il voyage dans un en-tête et non dans l'URL — les
// chemins finissent dans les journaux — et c'est son empreinte, non lui, qui
// sert de clé KV : la liste des clés visible dans le tableau de bord
// Cloudflare ne doit pas être une liste de mots de passe.
async function empreinte(code) {
  const octets = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return [...new Uint8Array(octets)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Un code trop court serait devinable ; l'app en génère de 26 caractères.
const codeValide = (c) => typeof c === "string" && /^[A-Za-z0-9_-]{20,128}$/.test(c);

async function sauvegarde(request, env, origine) {
  const entetes = corsHeaders(origine);

  if (!env.SYNC) {
    return new Response(
      JSON.stringify({ erreur: "Espace KV non configuré sur ce Worker (voir worker/README.md)." }),
      { status: 501, headers: { ...entetes, "Content-Type": "application/json" } }
    );
  }

  const code = request.headers.get("X-Sync-Code") || "";
  if (!codeValide(code)) {
    return new Response(JSON.stringify({ erreur: "Code de synchronisation absent ou mal formé." }),
      { status: 400, headers: { ...entetes, "Content-Type": "application/json" } });
  }
  const cle = await empreinte(code);

  if (request.method === "GET") {
    const contenu = await env.SYNC.get(cle);
    if (contenu === null) {
      return new Response(JSON.stringify({ erreur: "Aucune sauvegarde pour ce code." }),
        { status: 404, headers: { ...entetes, "Content-Type": "application/json" } });
    }
    return new Response(contenu, { status: 200, headers: { ...entetes, "Content-Type": "application/json" } });
  }

  // PUT — on relit le corps pour en mesurer la taille réelle : Content-Length
  // est déclaré par le client, donc il ne prouve rien.
  const corps = await request.text();
  if (corps.length > TAILLE_MAX) {
    return new Response(JSON.stringify({ erreur: "Sauvegarde trop volumineuse." }),
      { status: 413, headers: { ...entetes, "Content-Type": "application/json" } });
  }
  let charge;
  try { charge = JSON.parse(corps); } catch {
    return new Response(JSON.stringify({ erreur: "Corps JSON invalide." }),
      { status: 400, headers: { ...entetes, "Content-Type": "application/json" } });
  }
  if (!Array.isArray(charge?.games)) {
    return new Response(JSON.stringify({ erreur: "Le champ `games` doit être une liste." }),
      { status: 400, headers: { ...entetes, "Content-Type": "application/json" } });
  }

  // L'horodatage est posé par le serveur : l'horloge d'un appareil peut être
  // fausse, et c'est lui qui arbitre « qui est le plus récent ».
  const enregistre = JSON.stringify({
    games: charge.games,
    count: charge.games.length,
    updatedAt: new Date().toISOString(),
  });
  await env.SYNC.put(cle, enregistre);
  return new Response(enregistre, { status: 200, headers: { ...entetes, "Content-Type": "application/json" } });
}

export default {
  async fetch(request, env) {
    const origine = request.headers.get("Origin") || "";
    const autorisee = ORIGINES.includes(origine);

    if (request.method === "OPTIONS") {
      return autorisee
        ? new Response(null, { status: 204, headers: corsHeaders(origine) })
        : new Response("Origine non autorisée", { status: 403 });
    }
    if (!autorisee) return new Response("Origine non autorisée", { status: 403 });

    const url = new URL(request.url);

    if (url.pathname === "/sync") {
      if (request.method !== "GET" && request.method !== "PUT") {
        return new Response("Méthode non autorisée", { status: 405, headers: corsHeaders(origine) });
      }
      return sauvegarde(request, env, origine);
    }

    if (request.method !== "GET") return new Response("Méthode non autorisée", { status: 405 });

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
