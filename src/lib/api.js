// Appels aux sources externes : RAWG, Wikipédia FR, Wikidata, SteamGridDB, xbl.io.
// Aucune clé n'est embarquée : elles sont saisies dans l'onglet Réglages et
// stockées sur l'appareil. Ce module est le seul à parler au réseau.
// ── Clés API ────────────────────────────────────────────────────────────────
// Aucune clé n'est embarquée dans le code : chacun saisit les siennes dans l'onglet
// Réglages, elles sont stockées sur l'appareil (localStorage "gl_keys", volontairement
// séparé de "gl_v2" pour qu'elles ne partent JAMAIS dans l'Export JSON).
// `proxy` = base d'URL du relais CORS (Cloudflare Worker) pour SteamGridDB et xbl.io,
// qui n'exposent pas de CORS. Vide -> chemins relatifs (proxy du serveur de dev Vite).
const KEYS_STORAGE = "gl_keys";
const EMPTY_KEYS = { rawg: "", sgdb: "", xbl: "", proxy: "" };
export function loadKeys() {
  try { return { ...EMPTY_KEYS, ...(JSON.parse(localStorage.getItem(KEYS_STORAGE)) || {}) }; }
  catch { return { ...EMPTY_KEYS }; }
}
// Copie au niveau module pour que les helpers d'API y accèdent sans passer de paramètre.
let API_KEYS = loadKeys();
export function setApiKeys(k) {
  API_KEYS = { ...EMPTY_KEYS, ...k };
  try { localStorage.setItem(KEYS_STORAGE, JSON.stringify(API_KEYS)); } catch {}
}
// Base des appels relayés : le Worker en prod, le proxy Vite (relatif) en dev.
const proxyBase = () => (API_KEYS.proxy || "").replace(/\/+$/, "");

export async function rawgSearch(q) {
  if (!q || q.trim().length < 2 || !API_KEYS.rawg) return [];
  try {
    const r = await fetch(`https://api.rawg.io/api/games?key=${API_KEYS.rawg}&search=${encodeURIComponent(q)}&page_size=10`);
    const d = await r.json();
    return d.results || [];
  } catch { return []; }
}

export async function rawgDetail(id) {
  if (!API_KEYS.rawg) return null;
  try {
    const r = await fetch(`https://api.rawg.io/api/games/${id}?key=${API_KEYS.rawg}`);
    return await r.json();
  } catch { return null; }
}

const wikiPageUrl = (title) => `https://fr.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

// Cherche des titres candidats sur Wikipédia FR, sans clé.
// On utilise la recherche plein-texte (list=search) plutôt que opensearch : opensearch
// matche par préfixe et rate souvent le titre FR (ex. "Lego Star Wars: The Force Awakens"
// ne préfixe pas "Lego Star Wars : Le Réveil de la Force"). srsearch classe par pertinence
// et remonte le bon titre FR en tête. Retourne [{ title, url }] ; [] si rien / erreur.
export async function wikiFrenchTitles(q) {
  const clean = (q || "").trim();
  if (clean.length < 2) return [];
  try {
    const r = await fetch(`https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(clean)}&srlimit=5&srnamespace=0&format=json&origin=*`);
    if (!r.ok) return [];
    const d = await r.json();
    const hits = d?.query?.search || [];
    return hits.map(h => ({ title: h.title, url: wikiPageUrl(h.title) }));
  } catch { return []; }
}

// Normalise un titre pour comparaison (minuscules, sans accents ni ponctuation).
export const normTitle = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// Choisit le meilleur candidat Wikipédia pour un titre de jeu : correspondance exacte,
// sinon préfixe, sinon le premier résultat (pertinence). Évite de tomber sur la page
// "série" au lieu de la page du jeu (ex. Assassin's Creed Unity).
export function pickBestWikiTitle(query, results) {
  if (!results.length) return null;
  const q = normTitle(query);
  const exact = results.find(r => normTitle(r.title) === q);
  if (exact) return exact;
  const prefix = results.find(r => { const t = normTitle(r.title); return t.startsWith(q) || q.startsWith(t); });
  return prefix || results[0];
}

// Résumé (intro) + image principale d'un article Wikipédia FR. Sans clé.
// Retourne { extract, image } ; valeurs vides/null si absentes ou erreur.
export async function wikiArticleData(title) {
  try {
    const r = await fetch(`https://fr.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=true&explaintext=true&piprop=original|thumbnail&pithumbsize=500&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`);
    if (!r.ok) return { extract: "", image: null };
    const d = await r.json();
    const pages = d?.query?.pages || {};
    const page = Object.values(pages)[0] || {};
    return {
      extract: (page.extract || "").trim(),
      image: page.original?.source || page.thumbnail?.source || null,
    };
  } catch { return { extract: "", image: null }; }
}

// Infobox structurée via Wikidata (à partir du titre de l'article Wikipédia FR).
// Développeur, éditeur, dates de sortie par plateforme, mode de jeu, série (+ précédent/
// suivant). PAS le moteur (exclu). Retourne null si rien d'exploitable. Sans clé.
export async function wikidataInfobox(wikiTitle) {
  try {
    // 1) Qid de l'article
    const pp = await (await fetch(`https://fr.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&titles=${encodeURIComponent(wikiTitle)}&format=json&origin=*`)).json();
    const qid = Object.values(pp?.query?.pages || {})[0]?.pageprops?.wikibase_item;
    if (!qid) return null;
    // 2) claims de l'entité
    const ent = await (await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json&origin=*`)).json();
    const claims = ent?.entities?.[qid]?.claims || {};
    const ids = (p) => (claims[p] || []).map(c => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
    const rawDates = (claims["P577"] || []).map(c => ({
      date: (c.mainsnak?.datavalue?.value?.time || "").slice(1, 11),
      plat: c.qualifiers?.["P400"]?.[0]?.datavalue?.value?.id || null,
    })).filter(d => d.date);
    // 3) résolution des libellés (fr -> en -> mul -> id)
    const need = [...new Set([...ids("P178"), ...ids("P123"), ...ids("P404"), ...ids("P179"), ...ids("P155"), ...ids("P156"), ...rawDates.map(d => d.plat).filter(Boolean)])];
    const labels = {};
    if (need.length) {
      const lab = await (await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${need.join("|")}&props=labels&languages=fr|en|mul&format=json&origin=*`)).json();
      for (const id of need) { const e = lab?.entities?.[id]?.labels; labels[id] = e?.fr?.value || e?.en?.value || e?.mul?.value || null; }
    }
    const L = (arr) => arr.map(id => labels[id]).filter(Boolean);
    // dédoublonne les sorties par (plateforme, date), garde la plus ancienne par plateforme
    const relMap = new Map();
    for (const d of rawDates) {
      const key = d.plat || "_";
      if (!relMap.has(key) || d.date < relMap.get(key).date) relMap.set(key, { date: d.date, platform: d.plat ? labels[d.plat] : null });
    }
    const releases = [...relMap.values()].sort((a, b) => a.date.localeCompare(b.date));
    const info = {
      developers: L(ids("P178")),
      publishers: L(ids("P123")),
      modes: L(ids("P404")),
      series: L(ids("P179"))[0] || null,
      follows: L(ids("P155"))[0] || null,
      followedBy: L(ids("P156"))[0] || null,
      releases,
    };
    const hasAny = info.developers.length || info.publishers.length || info.modes.length || info.series || info.releases.length;
    return hasAny ? info : null;
  } catch { return null; }
}

// SteamGridDB n'expose pas de CORS : on passe par le proxy du serveur de dev
// (voir vite.config.js) qui relaie /sgdb/* vers l'API avec le token Authorization.
// Recherche un jeu sur SteamGridDB (autocomplete) -> [{ id, name }].
const sgdbHeaders = () => ({ Authorization: `Bearer ${API_KEYS.sgdb}` });
export async function sgdbSearch(term) {
  if (!term || term.trim().length < 2 || !API_KEYS.sgdb) return [];
  try {
    const r = await fetch(`${proxyBase()}/sgdb/search/autocomplete/${encodeURIComponent(term)}`, { headers: sgdbHeaders() });
    if (!r.ok) return [];
    const d = await r.json();
    return d?.data || [];
  } catch { return []; }
}

// Grids verticales (600x900, format boîte) d'un jeu SteamGridDB.
// -> [{ thumb, url }] : thumb pour l'aperçu (léger), url pour la cover finale.
export async function sgdbGrids(id) {
  if (!API_KEYS.sgdb) return [];
  try {
    const r = await fetch(`${proxyBase()}/sgdb/grids/game/${id}?dimensions=600x900`, { headers: sgdbHeaders() });
    if (!r.ok) return [];
    const d = await r.json();
    return (d?.data || []).map(x => ({ thumb: x.thumb || x.url, url: x.url })).filter(g => g.url);
  } catch { return []; }
}

// xbl.io n'expose pas de CORS : appels via le proxy Vite /xbl/* (token côté serveur).
// Historique des jeux Xbox du compte lié à la clé -> [{ name, devices, image, lastPlayed }].
// Filtré aux vrais jeux console Xbox (exclut PC-only / Win32 et apps/launchers).
const XBL_CONSOLE_DEVICES = ["XboxSeries", "XboxOne", "Xbox360"];
// xbl.io renvoie ses jaquettes en http://, et parfois depuis images-eds.xboxlive.com
// qui ne repond pas en TLS. Servie en HTTPS, la page bloquerait ces images (contenu
// mixte) ou echouerait a la negociation TLS : on bascule sur l'hote -ssl equivalent,
// puis on force le schema. Sans quoi la jaquette d'un jeu importe reste cassee.
const httpsImage = (u) => (u || "")
  .replace("images-eds.xboxlive.com", "images-eds-ssl.xboxlive.com")
  .replace(/^http:\/\//, "https://") || null;
const XBL_APP_BLOCKLIST = /\b(app on pc|launcher|xbox app|windows edition|for windows)\b/i;
export async function xblTitleHistory() {
  if (!API_KEYS.xbl) return [];
  try {
    const r = await fetch(`${proxyBase()}/xbl/player/titleHistory`, { headers: { "X-Authorization": API_KEYS.xbl } });
    if (!r.ok) return [];
    const d = await r.json();
    const titles = d?.content?.titles || [];
    return titles
      .filter(t => t.type === "Game")
      .filter(t => Array.isArray(t.devices) && t.devices.some(dev => XBL_CONSOLE_DEVICES.includes(dev)))
      .filter(t => !XBL_APP_BLOCKLIST.test(t.name || ""))
      .map(t => ({
        name: (t.name || "").trim(),
        devices: t.devices || [],
        image: t.displayImage ? httpsImage(t.displayImage) : null,
        lastPlayed: t.titleHistory?.lastTimePlayed || null,
      }))
      .filter(t => t.name);
  } catch { return []; }
}


// Premier résultat RAWG pour un titre. Sert au rattrapage des jaquettes
// manquantes au démarrage, qui interrogeait l'API en dupliquant cette requête
// depuis App.jsx — et lisait API_KEYS au passage.
export async function rawgFirstResult(title) {
  if (!API_KEYS.rawg) return null;
  try {
    const r = await fetch(`https://api.rawg.io/api/games?key=${API_KEYS.rawg}&search=${encodeURIComponent(title)}&page_size=1`);
    const d = await r.json();
    return d.results?.[0] || null;
  } catch { return null; }
}

// Y a-t-il une clé RAWG configurée ? Évite de lancer une salve d'appels voués
// à échouer au premier démarrage.
export const hasRawgKey = () => !!API_KEYS.rawg;
