// Ce que ces vérifications protègent n'est pas la syntaxe Gradle — Gradle la
// vérifie tout seul, et bruyamment. C'est le fait qu'une construction de
// publication cassée par R8 ne casse que sur le téléphone : l'APK sort, la CI
// est verte, l'application démarre, et c'est la première permission demandée
// qui tombe.

import { test } from "node:test";
import assert from "node:assert/strict";
import { reglerPublication, completerRegles } from "./publication-android.mjs";

const GRADLE = `apply plugin: 'com.android.application'

android {
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
`;

test("la publication réduit le code et les ressources", () => {
  const sortie = reglerPublication(GRADLE);
  assert.match(sortie, /minifyEnabled true/);
  assert.match(sortie, /shrinkResources true/);
});

test("la liste de règles est remplacée, pas complétée", () => {
  // proguard-android.txt contient -dontoptimize : ajouter la variante
  // « optimize » à côté ne l'activerait pas, l'autre l'annulerait.
  const sortie = reglerPublication(GRADLE);
  assert.match(sortie, /setProguardFiles\(\[/);
  assert.match(sortie, /proguard-android-optimize\.txt/);
  assert.doesNotMatch(sortie.split("Ajouté par")[1], /getDefaultProguardFile\('proguard-android\.txt'\)/);
});

test("l'APK de publication est signé par la même clé que les précédents", () => {
  // Une autre clé ferait une autre application : elle refuserait de
  // s'installer par-dessus, et désinstaller effacerait la bibliothèque.
  assert.match(reglerPublication(GRADLE), /signingConfig signingConfigs\.debug/);
});

test("deux passages ne configurent pas deux fois", () => {
  const une = reglerPublication(GRADLE);
  assert.equal(reglerPublication(une), une);
});

test("un gabarit sans buildTypes s'arrête ici", () => {
  assert.throws(() => reglerPublication("android { }"), /gabarit Capacitor a changé/);
});

test("les annotations de Capacitor survivent au mode complet", () => {
  const sortie = completerRegles("# vide\n");
  assert.match(sortie, /-keep @interface com\.getcapacitor\.annotation\.\*\* \{ \*; \}/);
  assert.match(sortie, /getPluginAnnotation\(\)/);
});

test("le pont WebView est gardé explicitement", () => {
  assert.match(completerRegles("# vide\n"), /@android\.webkit\.JavascriptInterface <methods>;/);
});

test("les règles existantes ne sont pas écrasées", () => {
  const sortie = completerRegles("-keep class MonTruc { *; }\n");
  assert.match(sortie, /-keep class MonTruc \{ \*; \}/);
});

test("deux passages n'empilent pas les règles", () => {
  const une = completerRegles("# vide\n");
  assert.equal(completerRegles(une), une);
});
