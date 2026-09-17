// Ce que l'application fait autrement quand elle est une app Android.
//
// Le reste du code ne sait pas où il tourne, et c'est voulu : les différences
// entre le site et l'APK vivent ici, nommées, plutôt que dispersées en
// `if (Capacitor…)` dans les composants. Le jour où une nouvelle apparaît, on
// sait où elle va.
//
// Elles sont huit :
//   - enregistrer un fichier, parce qu'une WebView ignore `<a download>` ;
//   - ouvrir un lien vers l'extérieur, parce qu'une WebView garde tout dedans ;
//   - le bouton Retour d'Android, qui n'existe pas sur le web, et le fait de
//     pouvoir quitter ;
//   - dire quelle version tourne, que les deux côtés numérotent autrement ;
//   - accorder la barre d'état au thème, que `theme-color` ne sait pas faire ;
//   - recevoir un fichier ouvert depuis une autre application ;
//   - rappeler une sauvegarde en retard quand personne ne regarde l'écran ;
//   - lire le code-barres d'une boîte, qu'un navigateur ne sait pas faire ;
//   - et `estNatif`, pour ce qui n'a de sens que d'un côté.

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Browser } from "@capacitor/browser";
import { App as AppNatif } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { LocalNotifications } from "@capacitor/local-notifications";
import { BarcodeScanner, BarcodeFormat } from "@capacitor-mlkit/barcode-scanning";
import { refermerLeDessus } from "./retour.js";
import { prochainRappel, rappelAReplanifier } from "./rappel.js";

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

// Un fichier qu'une autre application nous confie.
//
// Sur le web, importer une sauvegarde passe forcément par un sélecteur de
// fichiers : la page ne peut pas être une destination. Une application
// installée, si — elle se déclare capable d'ouvrir du JSON, et apparaît dans le
// « Ouvrir avec » du gestionnaire de fichiers, de Drive ou d'une pièce jointe.
//
// C'est ACTION_VIEW et non ACTION_SEND, et la nuance mérite d'être écrite :
// Capacitor ne fait remonter au JavaScript que les intentions VIEW, celles qui
// portent une adresse. « Partager vers Game Library » demanderait du Java dans
// le projet engendré. « Ouvrir avec » couvre les chemins réels — un fichier
// qu'on a reçu ou qu'on est allé chercher — sans rien ajouter.
//
// Deux cas, et le second est celui qu'on oublie : l'application est déjà
// ouverte (`appUrlOpen`), ou elle démarre à cause du fichier
// (`getLaunchUrl`) — un écouteur posé après coup ne verrait jamais le second.
export function surFichierRecu(quoi) {
  if (!estNatif()) return () => {};

  const lire = async (url) => {
    if (!url) return;
    try {
      const { data } = await Filesystem.readFile({ path: url, encoding: Encoding.UTF8 });
      quoi(typeof data === "string" ? data : "", url);
    } catch (e) {
      quoi(null, url, String(e?.message || e));
    }
  };

  AppNatif.getLaunchUrl().then(r => lire(r?.url)).catch(() => {});
  const promesse = AppNatif.addListener("appUrlOpen", e => lire(e?.url));
  return () => { promesse.then(h => h.remove()).catch(() => {}); };
}

// ── Le rappel de sauvegarde ────────────────────────────────────────────────
//
// Tout ce que l'application sait dire aujourd'hui, elle le dit à l'écran :
// une pastille sur ⚙️, une ligne orange dans les réglages. Les deux supposent
// qu'on ouvre l'application — or c'est quand on cesse de l'ouvrir qu'une
// sauvegarde vieillit sans que personne le sache. Une notification est la
// seule chose ici capable de s'adresser à quelqu'un qui n'est pas devant.
//
// `quand` vient de `prochainRappel()` dans rappel.js ; ce fichier ne décide
// de rien, il exécute.

// Un identifiant fixe, et c'est important : replanifier avec le même
// identifiant remplace l'ancien rendez-vous. Avec un identifiant tiré au sort,
// chaque ouverture de l'application empilerait un rappel de plus, et il en
// arriverait dix.
const ID_RAPPEL = 1;

// La permission ne se demande pas au lancement.
//
// Une application qui réclame le droit de notifier avant d'avoir rien montré
// se fait refuser, et sur Android un refus est définitif : la seule issue
// devient les réglages du système. On ne la demande donc qu'au moment où
// quelqu'un a explicitement demandé le rappel.
export async function demanderRappels() {
  if (!estNatif()) return false;
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display === "granted") return true;
    if (display === "denied") return false;
    const r = await LocalNotifications.requestPermissions();
    return r.display === "granted";
  } catch { return false; }
}

// Mettre le rappel en accord avec l'état réel.
//
// Appelée à chaque changement de la sauvegarde et à chaque ouverture : elle
// annule s'il n'y a plus rien à rappeler, et ne replanifie que si la date de
// sauvegarde a bougé. Sans cette dernière condition, ouvrir l'application
// repousserait le rappel au lendemain — celui qui ouvre tous les jours ne
// serait jamais prévenu, c'est-à-dire exactement l'inverse du but.
export async function accorderRappelSauvegarde({ actif, configuree, majLe }) {
  if (!estNatif()) return null;

  try {
    const enAttente = (await LocalNotifications.getPending()).notifications
      ?.find(n => n.id === ID_RAPPEL) || null;

    const quand = actif ? prochainRappel({ configuree, majLe }) : null;
    if (quand === null) {
      if (enAttente) await LocalNotifications.cancel({ notifications: [{ id: ID_RAPPEL }] });
      return null;
    }

    const pour = majLe || "";
    if (!rappelAReplanifier({ enAttente: enAttente && { pour: enAttente.extra?.pour }, pour })) {
      return enAttente.schedule?.at ? new Date(enAttente.schedule.at).getTime() : quand;
    }

    await LocalNotifications.schedule({
      notifications: [{
        id: ID_RAPPEL,
        title: "Sauvegarde en retard",
        // Le texte dit ce qui est en jeu, pas ce qu'il faut faire : « pense à
        // sauvegarder » se balaie sans lire. Ce qu'on retient, c'est que des
        // ajouts n'existent qu'ici.
        body: "Tes derniers ajouts n'existent que sur ce téléphone. Ouvre Game Library et envoie la sauvegarde.",
        schedule: { at: new Date(quand), allowWhileIdle: true },
        extra: { pour },
      }],
    });
    return quand;
  } catch {
    // Un rappel qu'on n'a pas pu poser ne casse rien : la pastille et la ligne
    // orange sont toujours là.
    return null;
  }
}

// ── Lire le code-barres d'une boîte ────────────────────────────────────────
//
// `scan()` passe par le lecteur de Google Play Services : l'interface, la
// caméra et le modèle sont fournis par le système. C'est le seul chemin qui ne
// demande pas la permission caméra — l'application ne voit jamais l'image,
// seulement le code lu. Sur un appareil sans Play Services, il n'y a rien à
// faire, et le bouton ne s'affiche pas.
//
// Le module se télécharge à la première utilisation. On le demande donc avant
// de scanner, sinon le premier scan de la vie de l'application échoue sans
// rien dire, et c'est le seul qu'on juge.
export async function scannerCodeBarres() {
  if (!estNatif()) return { ok: false, erreur: "Le scan n'existe que dans l'application." };

  try {
    const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!available) {
      await BarcodeScanner.installGoogleBarcodeScannerModule();
      return { ok: false, erreur: "Le lecteur de codes-barres s'installe. Réessaie dans un instant." };
    }

    const { barcodes } = await BarcodeScanner.scan({
      formats: [BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE],
    });
    const code = barcodes?.[0]?.rawValue || barcodes?.[0]?.displayValue || "";
    // Annuler est un geste délibéré, pas une panne : pas de message.
    if (!code) return { ok: false, erreur: null };
    return { ok: true, code };
  } catch (e) {
    return { ok: false, erreur: String(e?.message || e) };
  }
}

// Le scan est-il possible ici ? Un bouton qui n'a aucune chance de marcher ne
// doit pas s'afficher.
export async function scanPossible() {
  if (!estNatif()) return false;
  try { return (await BarcodeScanner.isSupported()).supported === true; }
  catch { return false; }
}
