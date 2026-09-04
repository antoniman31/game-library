// Ce que la sauvegarde en ligne transporte en plus des jeux.
//
// Deux risques, tous deux silencieux : envoyer des clés qu'on n'a pas voulu
// envoyer, et laisser une sauvegarde distante écraser un réglage local parce
// qu'elle contenait un champ vide ou aberrant.

import { test } from "node:test";
import assert from "node:assert/strict";
import { preferencesASauvegarder, preferencesRecues, resumePreferences } from "./preferences.js";

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
