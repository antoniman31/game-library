import { test } from "node:test";
import assert from "node:assert/strict";
import { envoyer, genererCode, recuperer } from "./sync.js";

// `fetch` remplacé : on regarde ce qui part et on choisit ce qui revient.
function simuler(reponse) {
  const appels = [];
  globalThis.fetch = async (url, init) => {
    appels.push({ url, init });
    if (reponse instanceof Error) throw reponse;
    return new Response(reponse.corps === undefined ? "" : JSON.stringify(reponse.corps), { status: reponse.statut ?? 200 });
  };
  return appels;
}

const PROXY = "https://relais.example.workers.dev/";
const CODE = "ABCDEFGHJKLMNPQRSTUVWXYZ23";

test("genererCode : 26 caractères d'un alphabet sans I, O, 0 ni 1", () => {
  for (let i = 0; i < 50; i++) assert.match(genererCode(), /^[A-HJ-NP-Z2-9]{26}$/);
});

test("sans relais ni code : rien ne part, le message dit quoi faire", async () => {
  const appels = simuler({ corps: {} });
  assert.match((await recuperer("", CODE)).erreur, /URL du relais/);
  assert.match((await recuperer(PROXY, "")).erreur, /code de synchronisation/);
  assert.equal(appels.length, 0);
});

test("envoyer : PUT sur /sync, code et base en en-têtes, barre finale de l'URL retirée", async () => {
  const appels = simuler({ corps: { count: 1, updatedAt: "2026-11-16T10:00:00.000Z" } });
  const r = await envoyer(PROXY, CODE, [{ id: 1 }], "2026-11-15T10:00:00.000Z");
  assert.equal(r.ok, true);
  assert.equal(appels[0].url, "https://relais.example.workers.dev/sync");
  assert.equal(appels[0].init.method, "PUT");
  assert.equal(appels[0].init.headers["X-Sync-Code"], CODE);
  assert.equal(appels[0].init.headers["X-Sync-Base"], "2026-11-15T10:00:00.000Z");
  assert.deepEqual(JSON.parse(appels[0].init.body), { games: [{ id: 1 }] });
});

test("recuperer : la version demandée part en en-tête, la courante n'en a pas", async () => {
  let appels = simuler({ corps: { games: [] } });
  await recuperer(PROXY, CODE);
  assert.equal(appels[0].init.headers["X-Sync-Version"], undefined);
  appels = simuler({ corps: { games: [] } });
  await recuperer(PROXY, CODE, 2);
  assert.equal(appels[0].init.headers["X-Sync-Version"], "2");
});

test("statuts : 404 (courante ou ancienne), 409 en conflit avec ses données, autre statut, réseau", async () => {
  simuler({ statut: 404, corps: {} });
  assert.equal((await recuperer(PROXY, CODE)).erreur, "Aucune sauvegarde pour ce code.");
  assert.equal((await recuperer(PROXY, CODE, 1)).erreur, "Aucune version précédente gardée.");
  simuler({ statut: 409, corps: { erreur: "Changé.", updatedAt: "x", count: 3 } });
  const conflit = await envoyer(PROXY, CODE, [], "vieille");
  assert.equal(conflit.conflit, true);
  assert.equal(conflit.data.count, 3);
  simuler({ statut: 500, corps: { erreur: "Panne du relais." } });
  assert.equal((await recuperer(PROXY, CODE)).erreur, "Panne du relais.");
  simuler({ statut: 502 });
  assert.equal((await recuperer(PROXY, CODE)).erreur, "Le relais a répondu 502.");
  simuler(new TypeError("Failed to fetch"));
  assert.match((await recuperer(PROXY, CODE)).erreur, /injoignable/);
});
