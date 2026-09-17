// Rendre l'application capable de recevoir un fichier.
//
// Sur le web, importer une sauvegarde passe forcément par un sélecteur de
// fichiers : une page ne peut pas être une destination. Une application
// installée, si — à condition de le déclarer. Sans ce filtre, ouvrir une
// sauvegarde depuis le gestionnaire de fichiers, Drive ou une pièce jointe ne
// propose jamais Game Library, alors que c'est la seule application au monde
// qui sache quoi en faire.
//
// Pourquoi un script plutôt qu'un fichier versionné : `android/` est engendré
// par Capacitor et n'entre pas dans le dépôt. Pourquoi un script plutôt qu'un
// `sed` dans le workflow : celui-ci se teste, et la construction locale en
// profite aussi.
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
const MARQUE = "ouvrir-fichiers-android.mjs";

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

export function declarerOuvertureFichiers(xml) {
  if (xml.includes(MARQUE)) return xml;

  const fin = xml.indexOf("</activity>");
  if (fin === -1) throw new Error("Aucune balise </activity> dans le manifeste : le gabarit Capacitor a changé.");

  // On recule jusqu'au début de la ligne : la balise fermante est indentée, et
  // insérer devant elle laisserait son indentation collée à notre premier
  // filtre.
  const ligne = xml.lastIndexOf("\n", fin) + 1;
  return xml.slice(0, ligne) + FILTRES + xml.slice(ligne);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const avant = readFileSync(MANIFESTE, "utf8");
  const apres = declarerOuvertureFichiers(avant);
  if (avant === apres) {
    console.log("Manifeste : filtres déjà présents.");
  } else {
    writeFileSync(MANIFESTE, apres);
    console.log("Manifeste : l'application peut désormais ouvrir un fichier .json.");
  }
}
