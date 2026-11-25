// La signature de Réglages › À propos (règle commune « Interface », 25/11/2026) : le logo AM.31, « Fait par AntoniMan31/Claude Code »
// et la version déployée. La date se lit en heure de Paris : un build lancé à 23 h 30 UTC un soir d'hiver est déjà le lendemain à Paris.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MENTION, versionTexte, estDoubleClic } from './mention.js';

test('la mention est le texte exact demandé', () => {
  assert.equal(MENTION, 'Fait par AntoniMan31/Claude Code');
});

test('la version donne le commit et la date du build, heure de Paris', () => {
  assert.equal(versionTexte('a1b2c3d', '2026-11-25T10:00:00Z'), 'version a1b2c3d · 25/11/2026');
  // Hiver (UTC+1) : 23 h 30 UTC le 31/12 est le 01/01 à Paris.
  assert.equal(versionTexte('a1b2c3d', '2026-12-31T23:30:00Z'), 'version a1b2c3d · 01/01/2027');
  // Été (UTC+2) : 22 h 30 UTC le 24/10 est déjà le 25/10 à Paris.
  assert.equal(versionTexte('a1b2c3d', '2026-10-24T22:30:00Z'), 'version a1b2c3d · 25/10/2026');
  // Nuit du passage à l'heure d'été : 00 h 30 UTC le 29/03 est 01 h 30 à Paris, le même jour.
  assert.equal(versionTexte('a1b2c3d', '2026-03-29T00:30:00Z'), 'version a1b2c3d · 29/03/2026');
});

test('une version absente ou une date illisible ne cassent pas la ligne', () => {
  assert.equal(versionTexte('', '2026-11-25T10:00:00Z'), 'version inconnue · 25/11/2026');
  assert.equal(versionTexte('a1b2c3d', 'pas une date'), 'version a1b2c3d');
  assert.equal(versionTexte(undefined, undefined), 'version inconnue');
});

test('deux appuis à moins de 350 ms font un double clic, pas un seul ni deux trop espacés', () => {
  assert.equal(estDoubleClic(0, 100), false, 'premier appui : rien avant');
  assert.equal(estDoubleClic(1000, 1200), true);
  assert.equal(estDoubleClic(1000, 1349), true);
  assert.equal(estDoubleClic(1000, 1350), false, 'au délai : trop tard');
  assert.equal(estDoubleClic(1000, 900), false, 'une horloge qui recule ne compte pas');
});
