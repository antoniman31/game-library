// Sauvegarde de la bibliothèque sur le Worker Cloudflare.
//
// Jusqu'ici la bibliothèque n'existait que dans le `localStorage` d'un
// navigateur : le PC et le téléphone en tenaient chacun une, sans pont entre
// les deux, et l'unique copie disparaissait avec les données de site. L'export
// JSON manuel est une sauvegarde qu'on ne fait pas.
//
// Le code de synchronisation est le seul secret. Il est rangé à part de la
// bibliothèque (`gl_sync`, jamais `gl_v2`) pour la même raison que les clés
// d'API : il ne doit pas partir dans un export qu'on partage.

import { lire, ecrire } from "./storage.js";

const CLE_SYNC = "gl_sync";

// `avecCles` est une préférence de CET appareil et ne se synchronise pas :
// chacun décide de ce qu'il expose, et une case cochée sur le PC ne doit pas
// se propager au téléphone du salon.
export function chargerSync() {
  try {
    const v = JSON.parse(lire(CLE_SYNC) || "{}");
    return {
      code: typeof v.code === "string" ? v.code : "",
      majLe: v.majLe || null,
      avecCles: v.avecCles === true,
    };
  } catch {
    return { code: "", majLe: null, avecCles: false };
  }
}

export function enregistrerSync(v) {
  ecrire(CLE_SYNC, JSON.stringify(v));
}

// 26 caractères tirés d'un alphabet de 32, soit 130 bits : indevinable.
// `crypto.getRandomValues` et non `Math.random`, qui n'est pas conçu pour ça.
// 256 est un multiple exact de 32, donc le modulo n'introduit aucun biais.
export function genererCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I, O, 0, 1 : illisibles recopiés à la main
  const octets = crypto.getRandomValues(new Uint8Array(26));
  return [...octets].map(o => alphabet[o % alphabet.length]).join("");
}

// Les deux appels partagent la même mécanique d'erreur : on veut un message
// lisible à l'écran, pas une promesse rejetée qui finit dans la console d'un
// téléphone que personne n'ouvrira.
async function appeler(proxy, code, methode, corps, base) {
  if (!proxy) return { ok: false, erreur: "Renseigne d'abord l'URL du relais CORS ci-dessus." };
  if (!code) return { ok: false, erreur: "Génère d'abord un code de synchronisation." };
  try {
    const r = await fetch(`${proxy.replace(/\/+$/, "")}/sync`, {
      method: methode,
      headers: {
        "X-Sync-Code": code,
        ...(base ? { "X-Sync-Base": base } : {}),
        ...(corps ? { "Content-Type": "application/json" } : {}),
      },
      body: corps,
    });
    let data = null;
    try { data = await r.json(); } catch { /* réponse non JSON : on s'en tient au statut */ }
    if (!r.ok) {
      if (r.status === 404) return { ok: false, erreur: "Aucune sauvegarde pour ce code." };
      // 409 : un autre appareil a envoyé depuis notre dernière synchronisation.
      // Ce n'est pas une erreur à afficher sèchement, c'est un choix à poser.
      if (r.status === 409) return { ok: false, conflit: true, data, erreur: data?.erreur || "Conflit de synchronisation." };
      return { ok: false, erreur: data?.erreur || `Le relais a répondu ${r.status}.` };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, erreur: "Relais injoignable (hors ligne, ou URL incorrecte)." };
  }
}

// `base` = l'horodatage de la sauvegarde vue en dernier par cet appareil. Le
// Worker refuse l'envoi s'il ne correspond plus, plutôt que d'écraser le
// travail d'un autre appareil en silence. `"force"` passe outre — l'app ne
// l'envoie qu'après une confirmation explicite.
//
// `prefs` accompagne la bibliothèque : l'apparence, et les clés de service si
// cet appareil a coché la case. Omis, il laisse en place ce que le relais
// avait déjà — un appareil resté sur une version antérieure n'efface donc pas
// les préférences des autres.
export const envoyer = (proxy, code, games, base, prefs) =>
  appeler(proxy, code, "PUT", JSON.stringify(prefs ? { games, prefs } : { games }), base);

export const recuperer = (proxy, code) =>
  appeler(proxy, code, "GET", null);
