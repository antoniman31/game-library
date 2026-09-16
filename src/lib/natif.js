// Ce que l'application fait autrement quand elle est une app Android.
//
// Le reste du code ne sait pas où il tourne, et c'est voulu : les quatre
// différences entre le site et l'APK vivent ici, nommées, plutôt que dispersées
// en `if (Capacitor…)` dans les composants. Le jour où une cinquième apparaît,
// on sait où elle va.
//
// Les cinq :
//   - enregistrer un fichier, parce qu'une WebView ignore `<a download>` ;
//   - ouvrir un lien vers l'extérieur, parce qu'une WebView garde tout dedans ;
//   - le bouton Retour d'Android, qui n'existe pas sur le web, et le fait de
//     pouvoir quitter ;
//   - dire quelle version tourne, que les deux côtés numérotent autrement ;
//   - accorder la barre d'état au thème, que `theme-color` ne sait pas faire ;
//   - et `estNatif`, pour ce qui n'a de sens que d'un côté.

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Browser } from "@capacitor/browser";
import { App as AppNatif } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { refermerLeDessus } from "./retour.js";

export const estNatif = () => Capacitor.isNativePlatform();

// Sortir un fichier de l'application.
//
// Sur le web, un lien invisible qu'on clique : c'est le mécanisme d'origine, et
// il marche. Dans une WebView Android, l'attribut `download` est purement et
// simplement ignoré — le clic ne fait rien, et rien ne le signale. C'était le
// défaut le plus grave du passage en application : l'export est la seule copie
// de la bibliothèque qui sorte de l'appareil, et il aurait échoué en silence.
//
// Côté natif on écrit donc vraiment le fichier, puis on ouvre le panneau de
// partage du système pour que l'utilisateur décide où il va — Drive, Fichiers,
// un message. Le fichier est écrit dans `Cache` : il a déjà été recopié là où
// l'utilisateur l'a envoyé, et l'y laisser encombrerait pour rien.
//
// Rend un libellé de ce qui s'est passé, pour que l'appelant puisse le dire.
export async function enregistrerFichier(nom, contenu) {
  if (!estNatif()) {
    const url = URL.createObjectURL(new Blob([contenu], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nom;
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true, partage: false };
  }

  const { uri } = await Filesystem.writeFile({
    path: nom,
    data: contenu,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  // Le partage peut être refusé par l'utilisateur : ce n'est pas une panne.
  try {
    await Share.share({ title: nom, url: uri, dialogTitle: "Enregistrer la sauvegarde" });
  } catch {
    return { ok: true, partage: false, chemin: uri };
  }
  return { ok: true, partage: true, chemin: uri };
}

// Ouvrir une adresse hors de l'application.
//
// Sur le web, `target="_blank"` suffit. Dans une WebView, un lien externe se
// charge DANS l'application, qui devient un navigateur sans barre d'adresse
// dont on ne peut plus sortir — ou, avec `_blank`, ne fait rien du tout. Les
// liens vers YouTube, Wikipédia, jeuxvideo.com et IGN passent donc par le
// navigateur du système.
//
// Les schémas qui ne sont pas du web — `sms:` pour relancer un emprunteur — ne
// passent PAS par là : c'est le système qui doit les recevoir, et Android le
// fait déjà avec un lien ordinaire.
export async function ouvrirLien(url) {
  if (!estNatif()) return false;      // le navigateur s'en charge lui-même
  if (!/^https?:/i.test(url)) return false; // sms:, mailto: — au système
  await Browser.open({ url });
  return true;                        // pris en charge : l'appelant annule le clic
}

// Les liens vers l'extérieur, interceptés une fois pour toutes.
//
// Huit liens mènent hors de l'application — YouTube, jeuxvideo.com, IGN,
// Wikipédia, les liens personnels d'une fiche, le « obtenir ↗ » des Réglages —
// et rien ne garantit qu'il n'y en aura pas un neuvième. Les retoucher un par
// un aurait laissé le prochain se glisser hors de la règle ; un seul écouteur
// sur le document les couvre tous, y compris ceux qui n'existent pas encore.
//
// La phase de capture, et non de bulle : on décide avant que React ne voie le
// clic. Et on ne touche qu'aux liens http(s) — `sms:` doit continuer d'aller
// au système, qui sait déjà quoi en faire.
export function installerLiensExternes() {
  if (!estNatif()) return () => {};
  const surClic = (e) => {
    const lien = e.target?.closest?.("a[href]");
    if (!lien) return;
    const url = lien.getAttribute("href") || "";
    if (!/^https?:/i.test(url)) return;   // sms:, mailto: — au système
    e.preventDefault();
    Browser.open({ url }).catch(() => {});
  };
  document.addEventListener("click", surClic, true);
  return () => document.removeEventListener("click", surClic, true);
}

// Le bouton Retour d'Android, un seul écouteur pour toute l'application.
//
// Il ne faisait rien. Rien du tout : ni refermer, ni quitter. La raison est
// dans le code de Capacitor —
//
//     if (!hasListeners("backButton")) {
//         if (webView.canGoBack()) { webView.goBack(); }
//     }
//
// — c'est-à-dire : sans écouteur enregistré, il remonte l'historique de la
// WebView, et s'il n'y en a pas, il ne se passe rien. L'activité ne se termine
// pas. Or une application à une seule page n'a pas d'historique, et l'écouteur
// n'existait que pendant qu'un panneau était ouvert. Le reste du temps — c'est
//-à-dire presque tout le temps — le bouton était mort, et on ne pouvait pas
// sortir de l'application autrement que par le geste d'accueil.
//
// L'écouteur est donc posé une fois pour toutes, comme celui des liens
// sortants, et il tranche : s'il y a quelque chose au premier plan, il le
// referme ; sinon il quitte. C'est ce que fait n'importe quelle application
// Android, et c'est ce que le geste veut dire.
//
// La pile de ce qui est au premier plan vit dans `retour.js`, qui ne connaît ni
// Android ni Capacitor : la décision se teste sans téléphone.
export function installerRetour(quandRienAFermer) {
  if (!estNatif()) return () => {};
  const promesse = AppNatif.addListener("backButton", () => {
    if (!refermerLeDessus()) quandRienAFermer();
  });
  return () => { promesse.then(h => h.remove()).catch(() => {}); };
}

// Quitter, pour de bon. `exitApp` termine l'activité ; sur le web il n'y a rien
// à quitter, et fermer un onglet ne se fait pas depuis la page.
export async function quitterApp() {
  if (!estNatif()) return;
  try { await AppNatif.exitApp(); } catch { /* rien à faire de plus */ }
}

// Quelle version tourne ici.
//
// Le site se met à jour tout seul, l'application s'installe à la main : dans
// les deux cas on pouvait avoir une version devant les yeux sans aucun moyen de
// savoir laquelle. Sur un APK qu'on installe à la main, c'est pire — rien ne le
// dit, et le `versionCode` engendré par Capacitor vaut 1 pour toutes les
// constructions, si bien qu'Android lui-même ne les distingue pas.
//
// Deux réponses, parce que les deux côtés numérotent autrement : l'application
// donne le numéro de construction qu'Android connaît, le site donne le commit.
// `__COMMIT__` est remplacé à la construction — hors de celle-ci, en test, il
// n'existe pas, d'où la garde.
export async function versionInstallee() {
  const commit = typeof __COMMIT__ === "string" ? __COMMIT__ : "développement";
  if (!estNatif()) return commit;
  try {
    const { build, version } = await AppNatif.getInfo();
    return `${version} (construction ${build})`;
  } catch {
    return commit;
  }
}

// La barre d'état du téléphone, accordée au thème de l'application.
//
// Sur le site, une balise `<meta name="theme-color">` suffit et l'application
// la met déjà à jour à chaque changement de thème. Dans une WebView, cette
// balise ne veut rien dire : la barre d'état appartient au système, pas à la
// page.
//
// Ce n'est pas un détail d'esthétique. L'application a son propre réglage
// clair/sombre, qui peut contredire celui du téléphone — c'est même la raison
// d'être des modes « Clair » et « Noir profond ». Téléphone en sombre et
// application en clair, le système dessinait des icônes claires sur l'en-tête
// clair de l'application : illisibles.
//
// Seul le style est réglé, pas la couleur de fond. Depuis qu'Android impose le
// bord à bord, la page est dessinée SOUS la barre d'état et c'est l'en-tête de
// l'application qu'on y voit — il n'y a donc rien à peindre, seulement à dire
// au système de quelle couleur faire ses icônes. `Style.Dark` veut dire « fond
// sombre », donc icônes claires.
export async function accorderBarreEtat(theme) {
  if (!estNatif()) return;
  try {
    await StatusBar.setStyle({ style: theme === "dark" ? Style.Dark : Style.Light });
  } catch { /* une barre d'état qu'on ne peut pas régler ne casse rien */ }
}
