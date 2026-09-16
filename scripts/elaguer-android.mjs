// Les écrans de démarrage en double, retirés du projet Android.
//
// `capacitor-assets` engendre l'écran de démarrage pour chaque combinaison
// d'orientation, de thème et de densité : vingt-six dossiers. Or le nôtre est
// un fond noir avec le logo au centre, et `icones-android.mjs` livre
// délibérément le même fichier pour le clair et pour le sombre — sans quoi
// l'outil en invente un autre, gris, vérifié.
//
// Les variantes `night` sont donc, octet pour octet, les mêmes images que
// leurs jumelles de jour, pour 420 Ko dans l'APK. Les retirer ne change rien à
// ce qui s'affiche : Android, ne trouvant pas de variante sombre, prend la
// variante de jour — la même image.
//
// Ce n'est pas un `rm` en aveugle. Chaque fichier est comparé à sa jumelle et
// n'est retiré que s'il en est le double exact : le jour où l'écran sombre
// cessera d'être identique au clair, il survivra, et ce script le dira.
//
//   node scripts/elaguer-android.mjs
//
// Tourne après `capacitor-assets generate`, dans `npm run android`.

import { readFile, readdir, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const res = fileURLToPath(new URL("../android/app/src/main/res", import.meta.url));

const memeContenu = async (a, b) => {
  try {
    const [x, y] = await Promise.all([readFile(a), readFile(b)]);
    return x.equals(y);
  } catch { return false; }
};

const dossiers = (await readdir(res)).filter(d => /^drawable-.+-night-/.test(d));
let retires = 0, octets = 0, gardes = [];

for (const d of dossiers) {
  // `drawable-port-night-xxhdpi` → `drawable-port-xxhdpi`
  const jumeau = d.replace("-night", "");
  const fichiers = await readdir(join(res, d));
  const doubles = await Promise.all(fichiers.map(f =>
    memeContenu(join(res, d, f), join(res, jumeau, f))));
  if (!doubles.every(Boolean)) { gardes.push(d); continue; }
  for (const f of fichiers) octets += (await stat(join(res, d, f))).size;
  await rm(join(res, d), { recursive: true });
  retires++;
}

console.log(`android/res : ${retires} dossier(s) sombre(s) retiré(s), ${Math.round(octets / 1024)} Ko`
  + (gardes.length ? ` · gardé(s) car différent(s) du jour : ${gardes.join(", ")}` : ""));
