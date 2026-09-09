// Ce que la sauvegarde en ligne transporte en plus des jeux.
//
// Deux risques, tous deux silencieux : envoyer des clés qu'on n'a pas voulu
// envoyer, et laisser une sauvegarde distante écraser un réglage local parce
// qu'elle contenait un champ vide ou aberrant.

import { test } from "node:test";
import assert from "node:assert/strict";
import { preferencesASauvegarder, preferencesRecues, resumePreferences,
  etatSauvegarde, texteAgeSauvegarde, affichageRecu, AFFICHAGE_DEFAUT, JOURS_SAUVEGARDE_VIEILLE } from "./preferences.js";

const CLES = { rawg: "R", sgdb: "S", xbl: "X", proxy: "https://relais.workers.dev" };

test("les clés ne partent que si l'appareil le demande", () => {
  const sans = preferencesASauvegarder({ modeTheme: "dark", keys: CLES, avecCles: false });
  assert.deepEqual(sans, { theme: "dark" });
  assert.equal(sans.keys, undefined, "la case décochée n'envoie rien");

  const avec = preferencesASauvegarder({ modeTheme: "auto", keys: CLES, avecCles: true });
  assert.deepEqual(avec.keys, { rawg: "R", sgdb: "S", xbl: "X" });
});

test("l'adresse du relais ne part jamais", () => {
  // La restaurer depuis la sauvegarde serait circulaire : il faut déjà le
  // relais pour aller chercher la sauvegarde.
  const p = preferencesASauvegarder({ modeTheme: "dark", keys: CLES, avecCles: true });
  assert.equal(p.keys.proxy, undefined);
  assert.equal(preferencesRecues({ keys: { proxy: "https://pirate.example" } }).keys, undefined);
});

test("une clé vide n'est pas envoyée et n'efface rien", () => {
  const p = preferencesASauvegarder({ modeTheme: "dark", keys: { rawg: "R", sgdb: "   " }, avecCles: true });
  assert.deepEqual(p.keys, { rawg: "R" }, "une clé blanche ne voyage pas");
  // Reçue vide, elle ne doit pas retirer celle de cet appareil.
  assert.equal(preferencesRecues({ keys: { rawg: "" } }).keys, undefined);
});

test("une sauvegarde aberrante ne change aucun réglage", () => {
  // Écrite par une autre version, ou corrompue : c'est une donnée, pas une
  // vérité. Ce qu'on ne reconnaît pas est ignoré, et l'appareil garde le sien.
  assert.deepEqual(preferencesRecues(null), {});
  assert.deepEqual(preferencesRecues("texte"), {});
  assert.deepEqual(preferencesRecues([]), {});
  assert.deepEqual(preferencesRecues({ theme: "arc-en-ciel" }), {});
  // `oled` venait d'une version où le noir profond se réglait à part : il
  // n'est plus lu, comme n'importe quel champ inconnu.
  assert.deepEqual(preferencesRecues({ oled: true }), {});
  assert.deepEqual(preferencesRecues({ keys: "volées" }), {});
  // Ce qu'on reconnaît passe.
  assert.deepEqual(preferencesRecues({ theme: "light" }), { modeTheme: "light" });
});

test("le résumé dit ce qui va être appliqué avant qu'on l'applique", () => {
  // « des préférences » ne se décide pas ; « l'apparence et 2 clés » si.
  assert.equal(resumePreferences({}), "");
  assert.equal(resumePreferences({ modeTheme: "dark" }), "l'apparence");
  assert.equal(resumePreferences({ keys: { rawg: "R" } }), "1 clé de service");
  assert.equal(resumePreferences({ modeTheme: "dark", keys: { rawg: "R", xbl: "X" } }), "l'apparence et 2 clés de service");
});


// ── Âge de la sauvegarde ───────────────────────────────────────────────────

const JOUR = 86400000;
const T0 = new Date("2026-09-09T12:00:00Z").getTime();

test("sans code ni relais, aucune sauvegarde à réclamer", () => {
  assert.equal(etatSauvegarde({ majLe: null, code: "", proxy: "https://x" }, T0).configuree, false);
  assert.equal(etatSauvegarde({ majLe: null, code: "abc", proxy: "  " }, T0).configuree, false);
  assert.equal(etatSauvegarde(undefined, T0).configuree, false);
  assert.equal(texteAgeSauvegarde({ configuree: false }), "");
});

test("une sauvegarde configurée dit son âge, et se signale au bout d'une semaine", () => {
  const sync = { code: "abc", proxy: "https://x" };
  assert.deepEqual(etatSauvegarde({ ...sync, majLe: null }, T0), { configuree: true, niveau: "jamais", jours: null });
  assert.equal(etatSauvegarde({ ...sync, majLe: new Date(T0).toISOString() }, T0).niveau, "fraiche");
  assert.equal(etatSauvegarde({ ...sync, majLe: new Date(T0 - 6 * JOUR).toISOString() }, T0).jours, 6);
  assert.equal(etatSauvegarde({ ...sync, majLe: new Date(T0 - 6 * JOUR).toISOString() }, T0).niveau, "fraiche");
  // Le seuil est atteint, pas dépassé : sept jours pile se signalent déjà.
  assert.equal(etatSauvegarde({ ...sync, majLe: new Date(T0 - JOURS_SAUVEGARDE_VIEILLE * JOUR).toISOString() }, T0).niveau, "vieille");
  // Une date illisible ne doit pas produire un âge de NaN jours.
  assert.equal(etatSauvegarde({ ...sync, majLe: "bientôt" }, T0).niveau, "jamais");
  // Une date dans le futur — horloge décalée entre deux appareils — ne donne
  // pas un âge négatif.
  assert.equal(etatSauvegarde({ ...sync, majLe: new Date(T0 + 3 * JOUR).toISOString() }, T0).jours, 0);
});

test("l'âge se dit en français, pas en millisecondes", () => {
  const sync = { code: "abc", proxy: "https://x" };
  const age = (j) => texteAgeSauvegarde(etatSauvegarde({ ...sync, majLe: new Date(T0 - j * JOUR).toISOString() }, T0));
  assert.equal(age(0), "aujourd'hui");
  assert.equal(age(1), "hier");
  assert.equal(age(12), "il y a 12 jours");
  assert.equal(texteAgeSauvegarde({ configuree: true, niveau: "jamais" }), "jamais envoyée depuis cet appareil");
});

// ── Réglages d'affichage ───────────────────────────────────────────────────

test("les réglages d'affichage relus sont ceux qu'on connaît, ou ceux par défaut", () => {
  const tris = ["titre", "date", "sortie", "metacritic", "aleatoire"];
  assert.deepEqual(affichageRecu(null, tris), AFFICHAGE_DEFAUT);
  assert.deepEqual(affichageRecu({ view: "grille", sort: "sortie", sortDir: -1, groupePar: "serie" }, tris),
    { view: "grille", sort: "sortie", sortDir: -1, groupePar: "serie" });
  // Une valeur inconnue — vieille version, fichier bricolé — retombe sur le
  // défaut plutôt que d'entrer telle quelle et de casser l'affichage.
  assert.deepEqual(affichageRecu({ view: "mosaique", sort: "prix", sortDir: 0, groupePar: "editeur" }, tris), AFFICHAGE_DEFAUT);
  // Le sens de tri n'accepte que 1 et -1 : un 2 renverserait le comparateur.
  assert.equal(affichageRecu({ sortDir: 2 }, tris).sortDir, 1);
  assert.equal(affichageRecu({ sortDir: -1 }, tris).sortDir, -1);
});
