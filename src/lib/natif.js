// Ce que l'application fait autrement quand elle est une app Android.
//
// Le reste du code ne sait pas où il tourne, et c'est voulu : les quatre
// différences entre le site et l'APK vivent ici, nommées, plutôt que dispersées
// en `if (Capacitor…)` dans les composants. Le jour où une cinquième apparaît,
// on sait où elle va.
//
// Les quatre :
//   - enregistrer un fichier, parce qu'une WebView ignore `<a download>` ;
//   - ouvrir un lien vers l'extérieur, parce qu'une WebView garde tout dedans ;
//   - le bouton Retour d'Android, qui n'existe pas sur le web ;
//   - et `estNatif`, pour ce qui n'a de sens que d'un côté.

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Browser } from "@capacitor/browser";
import { App as AppNatif } from "@capacitor/app";

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

// Le bouton Retour d'Android.
//
// Sans lui, il ferme l'application — y compris quand un panneau est ouvert
// par-dessus la liste, alors que le geste veut visiblement dire « referme ça ».
// Échap joue ce rôle au clavier depuis toujours ; c'est le même contrat.
//
// Rend une fonction de désinscription, comme un écouteur d'événement, pour que
// l'appelant n'ait pas à connaître la forme de l'objet rendu par Capacitor.
export function surRetour(quoi) {
  if (!estNatif()) return () => {};
  const promesse = AppNatif.addListener("backButton", quoi);
  return () => { promesse.then(h => h.remove()).catch(() => {}); };
}
