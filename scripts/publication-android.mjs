// Régler la construction de publication.
//
// Jusqu'ici l'APK était une construction de débogage : installable telle
// quelle, mais marquée `debuggable` — ce qui laisse n'importe quel appareil
// branché en USB lire les données de l'application — et sans aucune réduction
// de code. Tant que l'application ne dépendait que de Capacitor, ça ne pesait
// pas lourd. Le lecteur de codes-barres a changé l'échelle : CameraX, ML Kit
// et les services Google arrivent avec, et la plus grande part n'est jamais
// appelée.
//
// R8 retire ce qui n'est pas atteignable et `shrinkResources` les ressources
// devenues orphelines. Rien de tout cela ne touche au code web, qui vit dans
// `assets/` et n'est pas du bytecode.
//
// Le fichier `android/` est engendré : comme pour le manifeste, ce qu'on veut
// y ajouter se réapplique à chaque construction ou n'existe pas.

import { readFileSync, writeFileSync } from "node:fs";

const GRADLE = "android/app/build.gradle";
const PROGUARD = "android/app/proguard-rules.pro";
const MARQUE = "publication-android.mjs";

// `setProguardFiles` remplace la liste, `proguardFiles` y ajoute — et la
// différence est tout sauf cosmétique : le gabarit de Capacitor référence
// `proguard-android.txt`, qui contient `-dontoptimize`. Ajouter la variante
// « optimize » à côté ne l'activerait pas, elle serait annulée par l'autre.
//
// La clé de signature est celle du magasin fourni : une construction de
// publication signée par une clé de développement. Ce n'est pas ce qu'exige le
// Play Store, et c'est délibéré — une clé de publication se fabrique sur la
// machine de son propriétaire et ne traverse aucune conversation. Mais c'est
// la même clé que les APK précédents, donc celui-ci se pose par-dessus sans
// rien effacer.
export const BLOC_GRADLE = `
// Ajouté par scripts/${MARQUE}.
android {
    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            setProguardFiles([getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'])
            signingConfig signingConfigs.debug
        }
    }
}
`;

// Ce que R8 ne doit pas toucher.
//
// Capacitor livre déjà ses propres règles, appliquées automatiquement : elles
// gardent les classes de greffons et leurs méthodes annotées. Ce qu'elles ne
// gardent pas, ce sont les annotations elles-mêmes — et en mode complet, le
// défaut d'AGP 8, R8 constate qu'aucun code ne référence ces types, les
// supprime, puis en déduit que `getPluginAnnotation()` ne peut rendre que
// null. Le résultat est une application qui démarre et dont chaque permission
// lève une exception, uniquement en publication.
//
// La dernière règle est redondante avec `proguard-android-optimize.txt`. Elle
// est répétée parce que la perdre serait invisible jusqu'au téléphone :
// `@JavascriptInterface` est le seul pont entre la WebView et le natif.
export const REGLES = `
# Ajouté par scripts/${MARQUE}.

# R8 en mode complet supprime les annotations que plus rien ne référence, puis
# replie getPluginAnnotation() sur null : toutes les permissions cassent, et
# seulement en publication.
-keep @interface com.getcapacitor.annotation.** { *; }
-keep @interface com.getcapacitor.PluginMethod { *; }
-keep @interface com.getcapacitor.NativePlugin { *; }
-keepclassmembers class com.getcapacitor.PluginHandle {
    java.lang.Class pluginClass;
    com.getcapacitor.annotation.CapacitorPlugin pluginAnnotation;
    com.getcapacitor.NativePlugin legacyPluginAnnotation;
    com.getcapacitor.annotation.CapacitorPlugin getPluginAnnotation();
    com.getcapacitor.NativePlugin getLegacyPluginAnnotation();
    <init>(...);
}

# Le seul pont entre la WebView et le code natif.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
`;

export function reglerPublication(gradle) {
  if (gradle.includes(MARQUE)) return gradle;
  if (!gradle.includes("buildTypes")) {
    throw new Error("Aucun bloc buildTypes dans build.gradle : le gabarit Capacitor a changé.");
  }
  return gradle.trimEnd() + "\n" + BLOC_GRADLE;
}

export function completerRegles(regles) {
  if (regles.includes(MARQUE)) return regles;
  return regles.trimEnd() + "\n" + REGLES;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [chemin, transformer] of [[GRADLE, reglerPublication], [PROGUARD, completerRegles]]) {
    const avant = readFileSync(chemin, "utf8");
    const apres = transformer(avant);
    if (avant !== apres) writeFileSync(chemin, apres);
    console.log(`${chemin} : ${avant === apres ? "déjà réglé" : "réglé"}.`);
  }
}
