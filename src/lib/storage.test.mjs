import { test } from "node:test";
import assert from "node:assert/strict";

// `storage.js` garde en mémoire le premier échec de la session : chaque test
// importe donc une copie neuve du module.
let n = 0;
const neuf = () => import(`./storage.js?copie=${n++}`);

function stockage(erreurEcriture) {
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (erreurEcriture) throw erreurEcriture; m.set(k, String(v)); },
  };
}
const silence = () => { const c = console.error; console.error = () => {}; return () => { console.error = c; }; };

test("écriture réussie : true, relue telle quelle, aucun signalement", async () => {
  stockage(null);
  const { ecrire, lire, surEchecStockage } = await neuf();
  const vus = [];
  surEchecStockage((m) => vus.push(m));
  assert.equal(ecrire("gl_v2", "[]"), true);
  assert.equal(lire("gl_v2"), "[]");
  assert.deepEqual(vus, []);
});

test("quota dépassé : false et le message parle de stockage saturé et d'export", async () => {
  stockage(Object.assign(new Error("plein"), { name: "QuotaExceededError" }));
  const { ecrire, surEchecStockage } = await neuf();
  const vus = [];
  surEchecStockage((m) => vus.push(m));
  const remettre = silence();
  assert.equal(ecrire("gl_v2", "x"), false);
  remettre();
  assert.equal(vus.length, 1);
  assert.match(vus[0], /saturé/);
  assert.match(vus[0], /Exporte/);
});

test("autre panne : message d'inaccessibilité ; une seule alerte par session, rejouée aux abonnés tardifs", async () => {
  stockage(Object.assign(new Error("refus"), { name: "SecurityError" }));
  const { ecrire, surEchecStockage } = await neuf();
  const tot = [];
  surEchecStockage((m) => tot.push(m));
  const remettre = silence();
  ecrire("a", "1");
  ecrire("b", "2");
  remettre();
  assert.equal(tot.length, 1, "cent bandeaux identiques ne disent rien de plus");
  assert.match(tot[0], /inaccessible/);
  const tard = [];
  surEchecStockage((m) => tard.push(m));
  assert.deepEqual(tard, tot, "le premier échec arrive avant l'abonnement : il doit être rejoué");
});

test("un abonné qui lève ne masque pas l'échec aux autres", async () => {
  stockage(new Error("x"));
  const { ecrire, surEchecStockage } = await neuf();
  const vus = [];
  surEchecStockage(() => { throw new Error("abonné cassé"); });
  surEchecStockage((m) => vus.push(m));
  const remettre = silence();
  ecrire("a", "1");
  remettre();
  assert.equal(vus.length, 1);
});

test("lecture impossible : null, sans lever", async () => {
  globalThis.localStorage = { getItem: () => { throw new Error("bloqué"); } };
  const { lire } = await neuf();
  const remettre = silence();
  assert.equal(lire("gl_v2"), null);
  remettre();
});
