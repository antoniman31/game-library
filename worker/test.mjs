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

const appel = (methode, chemin, { origin = ORIG, code, base, corps, env: e = env } = {}) =>
  worker.fetch(new Request("https://w.dev" + chemin, {
    method: methode,
    headers: {
      Origin: origin,
      ...(code ? { "X-Sync-Code": code } : {}),
      ...(base ? { "X-Sync-Base": base } : {}),
    },
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

// ── Concurrence ────────────────────────────────────────────────────────────
// Le cœur du sujet : deux appareils qui envoient chacun de leur côté ne
// doivent pas pouvoir se détruire mutuellement sans le savoir.
const CODE2 = "MNPQRSTUVWXYZ23456789ABCDE";
r = await appel("PUT", "/sync", { code: CODE2, corps: JSON.stringify({ games: [{ id: 1, title: "Depuis le PC" }] }) });
const v1 = await r.json();
test("premier envoi accepté sans base", r.status === 200);

// Le téléphone envoie en annonçant la base qu'il connaît : accepté.
r = await appel("PUT", "/sync", { code: CODE2, base: v1.updatedAt, corps: JSON.stringify({ games: [{ id: 1, title: "A" }, { id: 2, title: "B" }] }) });
const v2 = await r.json();
test("envoi avec la bonne base accepté", r.status === 200 && v2.count === 2, `count=${v2.count}`);

// Le PC, resté sur l'ancienne base, essaie d'envoyer : refusé.
r = await appel("PUT", "/sync", { code: CODE2, base: v1.updatedAt, corps: JSON.stringify({ games: [{ id: 9, title: "Écrasement" }] }) });
const conflit = await r.json();
test("envoi avec une base périmée refusé (409)", r.status === 409, conflit.erreur);
test("le conflit rend l'état courant", conflit.count === 2 && conflit.updatedAt === v2.updatedAt);

// Et la sauvegarde n'a pas bougé.
r = await appel("GET", "/sync", { code: CODE2 });
j = await r.json();
test("la sauvegarde est intacte après un conflit", j.count === 2 && j.games[1].title === "B");

// Un envoi sans base du tout sur une sauvegarde existante est aussi refusé :
// c'est le cas de l'appareil qui n'a jamais récupéré.
r = await appel("PUT", "/sync", { code: CODE2, corps: JSON.stringify({ games: [] }) });
test("envoi sans base sur une sauvegarde existante refusé", r.status === 409);

// L'écrasement délibéré reste possible, mais il faut le demander.
r = await appel("PUT", "/sync", { code: CODE2, base: "force", corps: JSON.stringify({ games: [{ id: 5, title: "Choix assumé" }] }) });
test("écrasement explicite accepté avec base=force", r.status === 200 && (await r.json()).count === 1);

// Méthode
r = await appel("DELETE", "/sync", { code: CODE });
test("DELETE refusé", r.status === 405);

// CORS préliminaire
r = await appel("OPTIONS", "/sync");
test("preflight autorise PUT et X-Sync-Code",
  r.status === 204 && r.headers.get("Access-Control-Allow-Methods").includes("PUT")
  && r.headers.get("Access-Control-Allow-Headers").includes("X-Sync-Code")
  && r.headers.get("Access-Control-Allow-Headers").includes("X-Sync-Base"));

// KV absent : le relais doit continuer de vivre
r = await appel("GET", "/sync", { code: CODE, env: {} });
test("sans espace KV -> 501 explicite", r.status === 501, (await r.json()).erreur);

// Deux envois dans la même milliseconde.
//
// C'est le cas que le runner d'intégration continue a trouvé et que ma machine
// ne produisait jamais : `toISOString()` s'arrête à la milliseconde, deux
// versions successives portaient donc le même horodatage, et la base périmée
// d'un autre appareil passait pour à jour. Son envoi écrasait l'autre en
// silence. L'horloge est figée ici pour que le défaut ne dépende plus de la
// vitesse de la machine qui exécute les tests.
{
  const VraieDate = Date;
  const instant = VraieDate.now();
  // Une fonction plutôt qu'une sous-classe : `new Date(...)` rend l'objet
  // retourné par le constructeur, et on évite un `super()` qu'on ne peut pas
  // appeler ici sans perdre l'instant figé.
  function DateFigee(...a) { return a.length ? new VraieDate(...a) : new VraieDate(instant); }
  DateFigee.now = () => instant;
  DateFigee.parse = VraieDate.parse;
  DateFigee.UTC = VraieDate.UTC;
  DateFigee.prototype = VraieDate.prototype;
  globalThis.Date = DateFigee;

  const CODE3 = "23456789ABCDEFGHJKLMNPQRST";
  const v1 = await (await appel("PUT", "/sync", { code: CODE3, corps: JSON.stringify({ games: [{ id: 1, title: "PC" }] }) })).json();
  const v2 = await (await appel("PUT", "/sync", { code: CODE3, base: v1.updatedAt, corps: JSON.stringify({ games: [{ id: 1 }, { id: 2 }] }) })).json();
  test("deux versions dans la même milliseconde restent distinctes", v1.updatedAt !== v2.updatedAt, `${v1.updatedAt} vs ${v2.updatedAt}`);

  r = await appel("PUT", "/sync", { code: CODE3, base: v1.updatedAt, corps: JSON.stringify({ games: [{ id: 9, title: "Écrasement" }] }) });
  test("horloge figée : la base périmée est quand même refusée", r.status === 409);

  const apres = await (await appel("GET", "/sync", { code: CODE3 })).json();
  test("horloge figée : la sauvegarde de l'autre appareil est intacte", apres.count === 2, `count=${apres.count}`);

  globalThis.Date = VraieDate;
}

// Le relais d'origine n'a pas bougé
r = await appel("GET", "/inconnu/x");
test("chemin non relayable -> 404", r.status === 404);

console.log(echecs ? `\n${echecs} échec(s)` : "\nTout passe.");
process.exit(echecs ? 1 : 0);
