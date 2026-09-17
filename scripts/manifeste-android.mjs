// Les deux retouches au manifeste engendré.
//
// Capacitor engendre `android/`, qui n'entre pas dans le dépôt : ce qu'on veut
// y ajouter se réapplique à chaque construction, ou n'existe pas. Deux choses,
// pour deux raisons opposées — une capacité qui manque, une permission de trop.
//
// ── Ouvrir un fichier ──
//
// Sur le web, importer une sauvegarde passe forcément par un sélecteur de
// fichiers : une page ne peut pas être une destination. Une application
// installée, si — à condition de le déclarer. Sans ce filtre, ouvrir une
// sauvegarde depuis le gestionnaire de fichiers, Drive ou une pièce jointe ne
// propose jamais Game Library, alors que c'est la seule application au monde
// qui sache quoi en faire.
//
// Pourquoi un script plutôt qu'un `sed` dans le workflow : celui-ci se teste,
// et la construction locale en profite aussi.
//
// C'est ACTION_VIEW (« Ouvrir avec ») et non ACTION_SEND (« Partager vers ») :
// le greffon App de Capacitor ne fait remonter au JavaScript que les intentions
// VIEW porteuses d'une adresse — `if (!Intent.ACTION_VIEW.equals(action) ||
// url == null) return;`. Déclarer ACTION_SEND ferait apparaître l'application
// dans le panneau de partage, où elle ne recevrait rien : pire que de ne pas y
// être. Le jour où on voudra les deux, il faudra du Java dans le projet
// engendré.

import { readFileSync, writeFileSync } from "node:fs";

const MANIFESTE = "android/app/src/main/AndroidManifest.xml";
const MARQUE = "manifeste-android.mjs";

// Deux filtres, parce qu'un seul ne suffit jamais en pratique.
//
// Le premier dit la vérité : ce fichier est du JSON. C'est celui qui marche
// quand la source annonce correctement le type.
//
// Le second existe parce qu'elles ne l'annoncent pas toujours : une sauvegarde
// posée sur Drive ou passée par un message ressort souvent en
// `application/octet-stream`, et le premier filtre la laisserait passer. On
// retombe alors sur le nom : tout ce qui finit par `.json`. `host="*"` n'est
// pas décoratif — Android ignore un `pathPattern` sans hôte.
export const FILTRES = `            <!-- Ajouté par scripts/${MARQUE} : sans cela, « Ouvrir avec » ne
                 propose jamais Game Library pour une sauvegarde. -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="application/json" />
            </intent-filter>

            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:scheme="content" />
                <data android:scheme="file" />
                <data android:host="*" />
                <data android:mimeType="*/*" />
                <data android:pathPattern=".*\\\\.json" />
            </intent-filter>

`;

// Une permission dont on n'a pas besoin.
//
// Le greffon de notifications déclare SCHEDULE_EXACT_ALARM pour tout le monde,
// et cette déclaration se propage à l'APK au moment de la fusion des
// manifestes. Elle coûte deux choses : une entrée « Alarmes et rappels » dans
// les réglages du téléphone, et un refus au Play Store — Google la réserve aux
// réveils et aux agendas, ce qu'une bibliothèque de jeux n'est pas.
//
// On ne perd rien : le greffon retombe tout seul sur une alarme approximative,
// et un rappel de sauvegarde qui arrive à 10h09 plutôt qu'à 10h00 remplit
// exactement le même office.
const ALARME_EXACTE = "android.permission.SCHEDULE_EXACT_ALARM";

function retirerAlarmeExacte(xml) {
  if (xml.includes(`"${ALARME_EXACTE}" tools:node="remove"`)) return xml;

  const avecOutils = xml.includes('xmlns:tools=')
    ? xml
    : xml.replace("<manifest ", '<manifest xmlns:tools="http://schemas.android.com/tools" ');

  return avecOutils.replace("</manifest>",
    `    <!-- Ajouté par scripts/${MARQUE} : le greffon de notifications la\n`
    + `         déclare pour tout le monde, et nous n'en avons pas l'usage. -->\n`
    + `    <uses-permission android:name="${ALARME_EXACTE}" tools:node="remove" />\n</manifest>`);
}

export function ajusterManifeste(xml) {
  if (xml.includes(MARQUE)) return xml;

  const fin = xml.indexOf("</activity>");
  if (fin === -1) throw new Error("Aucune balise </activity> dans le manifeste : le gabarit Capacitor a changé.");

  // On recule jusqu'au début de la ligne : la balise fermante est indentée, et
  // insérer devant elle laisserait son indentation collée à notre premier
  // filtre.
  const ligne = xml.lastIndexOf("\n", fin) + 1;
  return retirerAlarmeExacte(xml.slice(0, ligne) + FILTRES + xml.slice(ligne));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const avant = readFileSync(MANIFESTE, "utf8");
  const apres = ajusterManifeste(avant);
  if (avant === apres) {
    console.log("Manifeste : filtres déjà présents.");
  } else {
    writeFileSync(MANIFESTE, apres);
    console.log("Manifeste : ouverture des .json déclarée, alarme exacte retirée.");
  }
}
