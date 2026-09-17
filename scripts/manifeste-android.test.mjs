// Le manifeste est engendré et n'entre pas dans le dépôt : personne ne le
// relit avant qu'il parte sur le téléphone. Ce que ce test protège, ce n'est
// pas la syntaxe XML — c'est le fait qu'une deuxième construction ne doit pas
// empiler les filtres, et qu'un changement de gabarit Capacitor doit s'arrêter
// ici plutôt que de produire en silence un APK qui n'ouvre rien.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ajusterManifeste } from "./manifeste-android.mjs";

const GABARIT = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application>
        <activity
            android:name=".MainActivity"
            android:launchMode="singleTask"
            android:exported="true">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

        </activity>
    </application>
</manifest>
`;

test("l'application se déclare capable d'ouvrir du JSON", () => {
  const sortie = ajusterManifeste(GABARIT);
  assert.match(sortie, /android.intent.action.VIEW/);
  assert.match(sortie, /android:mimeType="application\/json"/);
  // La sauvegarde ressort souvent en octet-stream : le repli par extension
  // est la moitié qui marche en vrai.
  assert.match(sortie, /android:pathPattern="\.\*\\\\\.json"/);
});

test("le lanceur reste le lanceur", () => {
  const sortie = ajusterManifeste(GABARIT);
  assert.equal((sortie.match(/android.intent.category.LAUNCHER/g) || []).length, 1);
  assert.equal((sortie.match(/action.MAIN/g) || []).length, 1);
});

test("les filtres s'insèrent dans l'activité, pas après", () => {
  const sortie = ajusterManifeste(GABARIT);
  assert.ok(sortie.indexOf("action.VIEW") < sortie.indexOf("</activity>"));
});

test("deux passages ne font pas quatre filtres", () => {
  const une = ajusterManifeste(GABARIT);
  assert.equal(ajusterManifeste(une), une);
});

test("un gabarit méconnaissable s'arrête ici", () => {
  assert.throws(() => ajusterManifeste("<manifest></manifest>"), /gabarit Capacitor a changé/);
});

test("l'alarme exacte est retirée", () => {
  const sortie = ajusterManifeste(GABARIT);
  assert.match(sortie, /xmlns:tools=/);
  assert.match(sortie, /SCHEDULE_EXACT_ALARM" tools:node="remove"/);
  // Le retrait se place hors de <application>, comme toute permission.
  assert.ok(sortie.indexOf("SCHEDULE_EXACT_ALARM") > sortie.indexOf("</application>"));
});
