import { test } from "node:test";
import assert from "node:assert/strict";
import { prochainRappel, rappelAReplanifier, HEURE_RAPPEL } from "./rappel.js";

const heureDe = (t) => new Date(t).getHours();
const jourDe = (t) => new Date(t).toDateString();

test("rien à rappeler sans synchronisation configurée", () => {
  assert.equal(prochainRappel({ configuree: false }), null);
  assert.equal(prochainRappel({}), null);
});

test("sept jours après la sauvegarde, le matin", () => {
  // Sauvegarde à 14h30 : elle n'a sept jours qu'à 14h30 le huitième, donc
  // après le rendez-vous de dix heures — le rappel tombe le neuvième matin.
  // On ne rappelle jamais une sauvegarde qui n'est pas encore en retard.
  const maintenant = new Date(2026, 0, 1, 14, 30).getTime();
  const quand = prochainRappel({ configuree: true, majLe: new Date(maintenant).toISOString() }, maintenant);
  assert.equal(heureDe(quand), HEURE_RAPPEL);
  assert.equal(jourDe(quand), new Date(2026, 0, 9).toDateString());
});

test("une sauvegarde du matin ne déclenche pas le rappel le jour même du septième", () => {
  // Sauvegarde à 8h : sept jours plus tard il est 8h, donc avant dix heures —
  // le rappel tombe le même jour, pas le lendemain.
  const maintenant = new Date(2026, 0, 1, 8, 0).getTime();
  const quand = prochainRappel({ configuree: true, majLe: new Date(maintenant).toISOString() }, maintenant);
  assert.equal(jourDe(quand), new Date(2026, 0, 8).toDateString());
  assert.equal(heureDe(quand), HEURE_RAPPEL);
});

test("jamais sauvegardé : le prochain matin, pas dans une semaine", () => {
  const maintenant = new Date(2026, 0, 1, 14, 0).getTime();
  const quand = prochainRappel({ configuree: true, majLe: null }, maintenant);
  assert.equal(jourDe(quand), new Date(2026, 0, 2).toDateString());
  assert.equal(heureDe(quand), HEURE_RAPPEL);
});

test("une date illisible se comporte comme jamais sauvegardé", () => {
  const maintenant = new Date(2026, 0, 1, 14, 0).getTime();
  assert.equal(prochainRappel({ configuree: true, majLe: "avant-hier" }, maintenant),
    prochainRappel({ configuree: true, majLe: null }, maintenant));
});

test("une sauvegarde déjà vieille ne sonne pas immédiatement", () => {
  const maintenant = new Date(2026, 5, 10, 15, 0).getTime();
  const quand = prochainRappel({ configuree: true, majLe: new Date(2026, 0, 1).toISOString() }, maintenant);
  assert.ok(quand > maintenant, "un rappel dans le passé ne sonnerait jamais");
  assert.equal(jourDe(quand), new Date(2026, 5, 11).toDateString());
});

test("le rappel ne tombe jamais dans le passé", () => {
  for (let h = 0; h < 24; h++) {
    const maintenant = new Date(2026, 2, 3, h, 17).getTime();
    for (const majLe of [null, new Date(2020, 0, 1).toISOString(), new Date(maintenant).toISOString()]) {
      const quand = prochainRappel({ configuree: true, majLe }, maintenant);
      assert.ok(quand > maintenant, `${h}h / ${majLe}`);
      assert.equal(heureDe(quand), HEURE_RAPPEL);
    }
  }
});

test("on ne replanifie pas tant que la sauvegarde n'a pas bougé", () => {
  const pour = "2026-01-01T00:00:00.000Z";
  assert.equal(rappelAReplanifier({ enAttente: { pour }, pour }), false);
  assert.equal(rappelAReplanifier({ enAttente: { pour }, pour: "2026-01-08T00:00:00.000Z" }), true);
  assert.equal(rappelAReplanifier({ enAttente: null, pour }), true);
});

test("jamais sauvegardé des deux côtés reste comparable", () => {
  assert.equal(rappelAReplanifier({ enAttente: { pour: "" }, pour: null }), false);
});
