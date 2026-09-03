// Tests du Worker, sans dépendance ni déploiement : Node fournit Request,
// Response et crypto.subtle, et un Map tient lieu d'espace KV.
//
//   node worker/test.mjs
//
// Ce qui compte ici n'est pas la couverture mais les invariants qu'on ne veut
// jamais casser par inadvertance : le cloisonnement entre deux codes, le fait
// que la clé KV soit une empreinte et non le code lui-même, et le fait que le
// relais CORS continue de fonctionner quand l'espace KV n'est pas configuré.

import worker from "./index.js";

const kv = new Map();
const env = { SYNC: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => void kv.set(k, v) } };
const ORIG = "https://antoniman31.github.io";

const appel = (methode, chemin, { origin = ORIG, code, corps, env: e = env } = {}) =>
  worker.fetch(new Request("https://w.dev" + chemin, {
    method: methode,
    headers: { Origin: origin, ...(code ? { "X-Sync-Code": code } : {}) },
    body: corps,
  }), e);

const CODE = "ABCDEFGHJKLMNPQRSTUVWXYZ23";
const dire = (nom, ok, detail = "") => console.log(`${ok ? "✓" : "✗ ÉCHEC"}  ${nom}${detail ? " — " + detail : ""}`);
let echecs = 0;
const test = (nom, ok, detail) => { if (!ok) echecs++; dire(nom, ok, detail); };

// Origine
let r = await appel("GET", "/sync", { origin: "https://evil.example", code: CODE });
test("origine non listée refusée", r.status === 403);

// Code
r = await appel("GET", "/sync");
test("code absent refusé", r.status === 400);
r = await appel("GET", "/sync", { code: "court" });
test("code trop court refusé", r.status === 400);

// Lecture avant écriture
r = await appel("GET", "/sync", { code: CODE });
test("aucune sauvegarde -> 404", r.status === 404);

// Écriture puis lecture
r = await appel("PUT", "/sync", { code: CODE, corps: JSON.stringify({ games: [{ id: 1, title: "Halo" }] }) });
let j = await r.json();
test("PUT accepté", r.status === 200 && j.count === 1, `count=${j.count}`);
test("horodatage posé par le serveur", typeof j.updatedAt === "string" && !isNaN(Date.parse(j.updatedAt)));

r = await appel("GET", "/sync", { code: CODE });
j = await r.json();
test("GET rend la sauvegarde", r.status === 200 && j.games[0].title === "Halo");

// Isolement entre codes
r = await appel("GET", "/sync", { code: "ZZZZZZZZZZZZZZZZZZZZZZZZZZ" });
test("un autre code ne voit rien", r.status === 404);

// La clé KV est une empreinte, pas le code
test("clé KV = empreinte SHA-256", [...kv.keys()].every(k => /^[0-9a-f]{64}$/.test(k) && k !== CODE), [...kv.keys()][0]?.slice(0, 16) + "…");

// Corps invalides
r = await appel("PUT", "/sync", { code: CODE, corps: "pas du json" });
test("corps non JSON refusé", r.status === 400);
r = await appel("PUT", "/sync", { code: CODE, corps: JSON.stringify({ jeux: [] }) });
test("champ games manquant refusé", r.status === 400);
r = await appel("PUT", "/sync", { code: CODE, corps: JSON.stringify({ games: ["x".repeat(2 * 1024 * 1024)] }) });
test("corps trop gros refusé", r.status === 413);

// Méthode
r = await appel("DELETE", "/sync", { code: CODE });
test("DELETE refusé", r.status === 405);

// CORS préliminaire
r = await appel("OPTIONS", "/sync");
test("preflight autorise PUT et X-Sync-Code",
  r.status === 204 && r.headers.get("Access-Control-Allow-Methods").includes("PUT")
  && r.headers.get("Access-Control-Allow-Headers").includes("X-Sync-Code"));

// KV absent : le relais doit continuer de vivre
r = await appel("GET", "/sync", { code: CODE, env: {} });
test("sans espace KV -> 501 explicite", r.status === 501, (await r.json()).erreur);

// Le relais d'origine n'a pas bougé
r = await appel("GET", "/inconnu/x");
test("chemin non relayable -> 404", r.status === 404);

console.log(echecs ? `\n${echecs} échec(s)` : "\nTout passe.");
process.exit(echecs ? 1 : 0);
