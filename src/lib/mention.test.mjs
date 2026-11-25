// La mention « Fait par AntoniMan31/Claude Code » et la version déployée (règle commune « Interface », 25/11/2026).
//
// Pourquoi : Réglages › À propos dit qui a fait l'appli et quelle version tourne sur l'appareil (commit court et date du
// build). La date se lit en heure de Paris : un build lancé à 23 h 30 UTC un soir d'hiver est déjà le lendemain à Paris.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MENTION, ligneVersion } from './mention.js';

test('la mention est le texte exact demandé', () => {
  assert.equal(MENTION, 'Fait par AntoniMan31/Claude Code');
});

test('la ligne donne le commit et la date du build, heure de Paris', () => {
  assert.equal(ligneVersion('a1b2c3d', '2026-11-25T10:00:00Z'), 'Fait par AntoniMan31/Claude Code · version a1b2c3d du 25/11/2026');
  // Hiver (UTC+1) : 23 h 30 UTC le 31/12 est le 01/01 à Paris.
  assert.equal(ligneVersion('a1b2c3d', '2026-12-31T23:30:00Z'), 'Fait par AntoniMan31/Claude Code · version a1b2c3d du 01/01/2027');
  // Été (UTC+2) : 22 h 30 UTC le 24/10 est déjà le 25/10 à Paris, la veille du passage à l'heure d'hiver.
  assert.equal(ligneVersion('a1b2c3d', '2026-10-24T22:30:00Z'), 'Fait par AntoniMan31/Claude Code · version a1b2c3d du 25/10/2026');
  // Nuit du passage à l'heure d'été : 00 h 30 UTC le 29/03 est 01 h 30 à Paris, le même jour.
  assert.equal(ligneVersion('a1b2c3d', '2026-03-29T00:30:00Z'), 'Fait par AntoniMan31/Claude Code · version a1b2c3d du 29/03/2026');
});

test('une version absente ou une date illisible ne cassent pas la ligne', () => {
  assert.equal(ligneVersion('', '2026-11-25T10:00:00Z'), 'Fait par AntoniMan31/Claude Code · version inconnue du 25/11/2026');
  assert.equal(ligneVersion('a1b2c3d', 'pas une date'), 'Fait par AntoniMan31/Claude Code · version a1b2c3d');
  assert.equal(ligneVersion(undefined, undefined), 'Fait par AntoniMan31/Claude Code · version inconnue');
});
