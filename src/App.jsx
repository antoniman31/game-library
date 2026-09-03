import { useState, useMemo, useEffect, useRef } from "react";

// ── Clés API ────────────────────────────────────────────────────────────────
// Aucune clé n'est embarquée dans le code : chacun saisit les siennes dans l'onglet
// Réglages, elles sont stockées sur l'appareil (localStorage "gl_keys", volontairement
// séparé de "gl_v2" pour qu'elles ne partent JAMAIS dans l'Export JSON).
// `proxy` = base d'URL du relais CORS (Cloudflare Worker) pour SteamGridDB et xbl.io,
// qui n'exposent pas de CORS. Vide -> chemins relatifs (proxy du serveur de dev Vite).
const KEYS_STORAGE = "gl_keys";
const EMPTY_KEYS = { rawg: "", sgdb: "", xbl: "", proxy: "" };
function loadKeys() {
  try { return { ...EMPTY_KEYS, ...(JSON.parse(localStorage.getItem(KEYS_STORAGE)) || {}) }; }
  catch { return { ...EMPTY_KEYS }; }
}
// Copie au niveau module pour que les helpers d'API y accèdent sans passer de paramètre.
let API_KEYS = loadKeys();
function setApiKeys(k) {
  API_KEYS = { ...EMPTY_KEYS, ...k };
  try { localStorage.setItem(KEYS_STORAGE, JSON.stringify(API_KEYS)); } catch {}
}
// Base des appels relayés : le Worker en prod, le proxy Vite (relatif) en dev.
const proxyBase = () => (API_KEYS.proxy || "").replace(/\/+$/, "");

async function rawgSearch(q) {
  if (!q || q.trim().length < 2 || !API_KEYS.rawg) return [];
  try {
    const r = await fetch(`https://api.rawg.io/api/games?key=${API_KEYS.rawg}&search=${encodeURIComponent(q)}&page_size=10`);
    const d = await r.json();
    return d.results || [];
  } catch { return []; }
}

async function rawgDetail(id) {
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
async function wikiFrenchTitles(q) {
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
const normTitle = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// Choisit le meilleur candidat Wikipédia pour un titre de jeu : correspondance exacte,
// sinon préfixe, sinon le premier résultat (pertinence). Évite de tomber sur la page
// "série" au lieu de la page du jeu (ex. Assassin's Creed Unity).
function pickBestWikiTitle(query, results) {
  if (!results.length) return null;
  const q = normTitle(query);
  const exact = results.find(r => normTitle(r.title) === q);
  if (exact) return exact;
  const prefix = results.find(r => { const t = normTitle(r.title); return t.startsWith(q) || q.startsWith(t); });
  return prefix || results[0];
}

// Résumé (intro) + image principale d'un article Wikipédia FR. Sans clé.
// Retourne { extract, image } ; valeurs vides/null si absentes ou erreur.
async function wikiArticleData(title) {
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
async function wikidataInfobox(wikiTitle) {
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
async function sgdbSearch(term) {
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
async function sgdbGrids(id) {
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
async function xblTitleHistory() {
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


const GAMES_INIT = [
  { id: 1, title: "Watch Dogs", platform: "Xbox", format: "physique", addedDate: "2014-05-27", genre: ["Action", "Aventure", "Open World"], style: "Hack & slash en monde ouvert, Chicago fictionnel", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 2, title: "Rayman Legends", platform: "Xbox", format: "physique", addedDate: "2013-08-29", genre: ["Plateforme"], style: "Plateforme 2D coloré, niveaux musicaux iconiques", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 3, title: "Forza Horizon 2", platform: "Xbox", format: "physique", addedDate: "2014-09-30", genre: ["Course", "Open World"], style: "Course open world, décors européens, ambiance festival", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 4, title: "GTA V", platform: "Xbox", format: "physique", addedDate: "2014-11-18", genre: ["Action", "Open World"], style: "Crime open world, 3 protagonistes, Los Santos", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 5, title: "Middle-earth Shadow of Mordor", platform: "Xbox", format: "physique", addedDate: "2014-09-30", genre: ["Action", "RPG"], style: "Action RPG, système Némésis, univers Tolkien", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 6, title: "Assassin's Creed Unity", platform: "Xbox", format: "physique", addedDate: "2014-11-11", genre: ["Action", "Aventure", "Furtif"], style: "Paris révolutionnaire, parkour, coop 4 joueurs", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 7, title: "LEGO Batman 3", platform: "Xbox", format: "physique", addedDate: "2014-11-11", genre: ["Action", "Plateforme"], style: "Aventure Lego humoristique, univers DC", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 8, title: "Batman Arkham Knight", platform: "Xbox", format: "physique", addedDate: "2015-06-23", genre: ["Action", "Aventure"], style: "Action/Bat-mobile, Gotham, conclusion trilogie", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 9, title: "FIFA 16", platform: "Xbox", format: "physique", addedDate: "2015-09-22", genre: ["Sport"], style: "Football simulation, premier FIFA avec équipes féminines", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 10, title: "Need for Speed 2015", platform: "Xbox", format: "physique", addedDate: "2015-11-03", genre: ["Course"], style: "Street racing nocturne, tuning, monde ouvert connecté", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 11, title: "Rise of the Tomb Raider", platform: "Xbox", format: "physique", addedDate: "2015-11-10", genre: ["Action", "Aventure"], style: "Survie et exploration, Lara 2.0, Sibérie", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 12, title: "Fallout 4", platform: "Xbox", format: "physique", addedDate: "2015-11-10", genre: ["RPG", "Open World", "FPS"], style: "Post-apo Boston, craft, base building, choix moraux", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 13, title: "Star Wars Battlefront", platform: "Xbox", format: "physique", addedDate: "2015-11-17", genre: ["FPS", "Multijoueur"], style: "Multijoueur Guerre des Étoiles, batailles emblématiques", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 14, title: "Just Cause 3", platform: "Xbox", format: "physique", addedDate: "2015-12-01", genre: ["Action", "Open World"], style: "Sandbox explosif, grappin + wingsuit, île méditerranéenne", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 15, title: "LEGO Marvel Avengers", platform: "Xbox", format: "physique", addedDate: "2016-01-26", genre: ["Action", "Plateforme"], style: "Aventure Lego Marvel, héros Avengers", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 16, title: "Trackmania Turbo", platform: "Xbox", format: "physique", addedDate: "2016-03-24", genre: ["Course", "Arcade"], style: "Course arcade ultra-précis, éditeur de circuits", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 17, title: "LEGO Star Wars The Force Awakens", platform: "Xbox", format: "physique", addedDate: "2016-06-28", genre: ["Action", "Plateforme"], style: "Aventure Lego Star Wars, épisode VII", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 18, title: "Forza Horizon 3", platform: "Xbox", format: "physique", addedDate: "2016-09-27", genre: ["Course", "Open World"], style: "Festival open world en Australie, best of la série", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 19, title: "Gears of War 4", platform: "Xbox", format: "physique", addedDate: "2016-10-11", genre: ["TPS", "Action"], style: "TPS cover-shooter, nouvelle génération de COGs", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 20, title: "Watch Dogs 2", platform: "Xbox", format: "physique", addedDate: "2016-11-15", genre: ["Action", "Aventure", "Open World"], style: "Hack & humour, San Francisco, DedSec", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 21, title: "Injustice 2", platform: "Xbox", format: "physique", addedDate: "2017-05-16", genre: ["Combat"], style: "Versus fighting DC, progression RPG, Multiverse", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 22, title: "FIFA 17", platform: "Xbox", format: "physique", addedDate: "2016-09-29", genre: ["Sport"], style: "Football simulation, mode The Journey introduit", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 23, title: "Star Wars Battlefront II", platform: "Xbox", format: "physique", addedDate: "2017-11-17", genre: ["FPS", "TPS", "Multijoueur"], style: "Campagne solo + multijoueur, toute la saga SW", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 24, title: "FIFA 18", platform: "Xbox", format: "physique", addedDate: "2017-09-29", genre: ["Sport"], style: "Football simulation, Ronaldo en couverture", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 25, title: "Shadow of the Tomb Raider", platform: "Xbox", format: "physique", addedDate: "2018-09-14", genre: ["Action", "Aventure"], style: "Jungle amazonienne, furtivité accrue, conclusion trilogie", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 26, title: "Hitman 2", platform: "Xbox", format: "physique", addedDate: "2018-11-13", genre: ["Furtif", "Action"], style: "Bac à sable assassinat, missions créatives, Agent 47", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 27, title: "Red Dead Redemption II", platform: "Xbox", format: "physique", addedDate: "2018-10-26", genre: ["Action", "Aventure", "Open World"], style: "Western immersif, narration magistrale, Far West 1899", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 28, title: "Assassin's Creed Origins", platform: "Xbox", format: "physique", addedDate: "2017-10-27", genre: ["Action", "RPG", "Open World"], style: "Reboot RPG, Égypte antique, Bayek", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 29, title: "Batman Arkham Collection", platform: "Xbox", format: "physique", addedDate: "2019-09-01", genre: ["Action", "Aventure"], style: "Trilogie complète Rocksteady, le meilleur du Batman gaming", status: "non commencé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 30, title: "Halo The Master Chief Collection", platform: "Xbox", format: "physique", addedDate: "2014-11-11", genre: ["FPS"], style: "6 jeux Halo remastérisés, campagne + multijoueur légendaire", status: "en cours", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 31, title: "Halo 4", platform: "Xbox", format: "physique", addedDate: "2012-11-06", genre: ["FPS"], style: "Master Chief vs Didact, narration émotionnelle", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 32, title: "Halo 5 Guardians", platform: "Xbox", format: "physique", addedDate: "2015-10-27", genre: ["FPS"], style: "Fireteam, coop 4 joueurs, Warzone multijoueur", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 33, title: "Destroy All Humans", platform: "Xbox", format: "physique", addedDate: "2020-07-28", genre: ["Action", "Open World"], style: "Parodie sci-fi années 50, invasion extraterrestre", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 34, title: "Marvel's Avengers", platform: "Xbox", format: "physique", addedDate: "2020-09-04", genre: ["Action", "RPG"], style: "GaaS Avengers, looter brawler, multi coop", status: "abandonné", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 35, title: "Star Wars Jedi Fallen Order", platform: "Xbox", format: "physique", addedDate: "2019-11-15", genre: ["Action", "Aventure"], style: "Soulslike Star Wars, Cal Kestis, exploration planètes", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 36, title: "Watch Dogs Legion", platform: "Xbox", format: "physique", addedDate: "2020-10-29", genre: ["Action", "Aventure", "Open World"], style: "Londres dystopique, jouer n'importe qui, DedSec", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 37, title: "Assassin's Creed Valhalla", platform: "Xbox", format: "physique", addedDate: "2020-11-10", genre: ["Action", "RPG", "Open World"], style: "Vikings Angleterre médiévale, raids, mythologie", status: "en cours", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 38, title: "Cyberpunk 2077", platform: "Xbox", format: "physique", addedDate: "2020-12-10", genre: ["RPG", "Open World", "FPS"], style: "Night City, cyberpunk immersif, build V, Phantom Liberty", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 39, title: "Tony Hawk's Pro Skater 1+2", platform: "Xbox", format: "physique", addedDate: "2020-09-04", genre: ["Sport", "Arcade"], style: "Skate arcade culte remastérisé, combo chains, bande-son légendaire", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 40, title: "Hitman 3", platform: "Xbox", format: "physique", addedDate: "2021-01-20", genre: ["Furtif", "Action"], style: "Conclusion trilogie WoA, Dubai, Dartmoor, Berlin", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 41, title: "Sonic Generations", platform: "Xbox", format: "physique", addedDate: "2011-11-01", genre: ["Plateforme", "Action"], style: "Classique vs Modern Sonic, niveaux emblématiques revisités", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 42, title: "Microsoft Flight Simulator", platform: "Xbox", format: "physique", addedDate: "2021-07-27", genre: ["Simulation"], style: "Simulation vol ultra-réaliste, monde entier, météo live", status: "en cours", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 43, title: "Alan Wake Remastered", platform: "Xbox", format: "physique", addedDate: "2021-10-05", genre: ["Action", "Horreur"], style: "Thriller psychologique, lumière comme arme, ambiance TV série", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 44, title: "DOOM Eternal", platform: "Xbox", format: "physique", addedDate: "2020-03-20", genre: ["FPS", "Action"], style: "FPS frénétique, gestion ressources, rip & tear", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 45, title: "Halo Infinite", platform: "Xbox", format: "physique", addedDate: "2021-12-08", genre: ["FPS"], style: "Open world partiel, grappin, multijoueur free-to-play", status: "en cours", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 46, title: "Elden Ring", platform: "Xbox", format: "physique", addedDate: "2022-02-25", genre: ["RPG", "Action", "Soulslike"], style: "Soulslike open world, FromSoftware x G.R.R. Martin", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 47, title: "Forza Horizon 5", platform: "Xbox", format: "physique", addedDate: "2021-11-09", genre: ["Course", "Open World"], style: "Festival Mexique, 500+ voitures, météo dynamique", status: "en cours", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 48, title: "Hogwarts Legacy", platform: "Xbox", format: "physique", addedDate: "2023-02-10", genre: ["RPG", "Action", "Aventure"], style: "Monde ouvert Harry Potter années 1800, sorts, Poudlard", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 49, title: "Star Wars Jedi Survivor", platform: "Xbox", format: "physique", addedDate: "2023-04-28", genre: ["Action", "Aventure"], style: "Suite Fallen Order, 5 styles de combat, Koboh", status: "en cours", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 50, title: "Starfield", platform: "Xbox", format: "physique", addedDate: "2023-09-06", genre: ["RPG", "Open World", "FPS"], style: "Space RPG Bethesda, 1000 planètes, New Atlantis", status: "en cours", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 51, title: "Fallout 76", platform: "Xbox", format: "physique", addedDate: "2018-11-14", genre: ["RPG", "Open World", "Multijoueur"], style: "Post-apo multijoueur en ligne, Virginie-Occidentale", status: "abandonné", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 52, title: "Indiana Jones and the Great Circle", platform: "Xbox", format: "physique", addedDate: "2024-12-09", genre: ["Action", "Aventure"], style: "FPS aventure Indy 1937, énigmes archéologiques, MachineGames", status: "non commencé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 53, title: "007 First Light", platform: "Xbox", format: "physique", addedDate: "2026-05-27", genre: ["Action", "Furtif"], style: "Origine de Bond, stealth-action, IO Interactive", status: "non commencé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 54, title: "Mario Kart World", platform: "Switch 2", format: "démat", addedDate: "2025-06-05", genre: ["Course", "Multijoueur"], style: "Kart arcade open world, 24 coureurs, circuits mondiaux", status: "en cours", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 55, title: "Donkey Kong Bananza", platform: "Switch 2", format: "physique", addedDate: "2025-07-17", genre: ["Plateforme", "Action"], style: "3D plateforme destructible, Pauline coop, terres souterraines", status: "en cours", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 56, title: "Super Mario Galaxy 2", platform: "Switch 2", format: "démat", addedDate: "2010-05-23", genre: ["Plateforme"], style: "Plateforme 3D dans l'espace, Yoshi, niveau culte", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 57, title: "Metroid Prime 4 Beyond", platform: "Switch 2", format: "physique", addedDate: "2025-12-04", genre: ["FPS", "Aventure", "Exploration"], style: "Metroidvania FPS, Samus, planète Viewros", status: "non commencé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 58, title: "Yoshi and the Mysterious Book", platform: "Switch 2", format: "physique", addedDate: "2026-05-21", genre: ["Plateforme"], style: "Plateforme cosy, Good-Feel", status: "non commencé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 59, title: "The Legend of Zelda Breath of the Wild", platform: "Switch 1", format: "physique", addedDate: "2017-03-03", genre: ["Action", "Aventure", "Open World"], style: "Open world révolutionnaire, physique sandbox, Hyrule", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 60, title: "Mario Kart 8 Deluxe", platform: "Switch 1", format: "physique", addedDate: "2017-04-28", genre: ["Course", "Multijoueur"], style: "Kart arcade Nintendo, 96 circuits DLC, référence du genre", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 61, title: "Ultra Street Fighter II", platform: "Switch 1", format: "physique", addedDate: "2017-05-26", genre: ["Combat"], style: "SF2 remasterisé + nouveaux persos, mode classique", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 62, title: "Sonic Mania Plus", platform: "Switch 1", format: "physique", addedDate: "2018-07-17", genre: ["Plateforme", "Action"], style: "Sonic 2D love letter, pixel art, Encore mode", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 63, title: "Super Mario Odyssey", platform: "Switch 1", format: "physique", addedDate: "2017-10-27", genre: ["Plateforme"], style: "3D sandbox, Cappy mécanique, 17 royaumes à explorer", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 64, title: "Captain Toad Treasure Tracker", platform: "Switch 1", format: "physique", addedDate: "2018-07-13", genre: ["Puzzle", "Plateforme"], style: "Puzzle diorama isométrique, adorable et malin", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 65, title: "Pokemon Let's Go Pikachu", platform: "Switch 1", format: "physique", addedDate: "2018-11-16", genre: ["RPG", "Aventure"], style: "Kanto revisité, capture Joy-Con, fusion Pokémon GO", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 66, title: "New Super Mario Bros U Deluxe", platform: "Switch 1", format: "physique", addedDate: "2019-01-11", genre: ["Plateforme"], style: "Plateforme 2D classique, coop 4 joueurs, Peachette", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 67, title: "Yoshi's Crafted World", platform: "Switch 1", format: "physique", addedDate: "2019-03-29", genre: ["Plateforme"], style: "Plateforme artisanal, décors en carton, face et revers des niveaux", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 68, title: "Nintendo Labo VR Kit", platform: "Switch 1", format: "physique", addedDate: "2019-04-12", genre: ["Autre"], style: "Réalité virtuelle carton, expérimental, mini-jeux créatifs", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 69, title: "Super Mario Maker 2", platform: "Switch 1", format: "physique", addedDate: "2019-06-28", genre: ["Plateforme", "Créatif"], style: "Éditeur de niveaux Mario, 5 styles, partage communauté", status: "en cours", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 70, title: "Spyro Reignited Trilogy", platform: "Switch 1", format: "physique", addedDate: "2019-09-03", genre: ["Plateforme", "Aventure"], style: "Trilogie Spyro remasterisée, nostalgie PS1 sublimée", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 71, title: "The Legend of Zelda Link's Awakening", platform: "Switch 1", format: "physique", addedDate: "2019-09-20", genre: ["Action", "Aventure", "RPG"], style: "Remake Gameboy, esthétique jouet, Koholint", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 72, title: "Luigi's Mansion 3", platform: "Switch 1", format: "physique", addedDate: "2019-10-31", genre: ["Action", "Aventure", "Puzzle"], style: "Hôtel hanté, Gooigi, boss créatifs, coop local", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 73, title: "Monopoly for Nintendo Switch", platform: "Switch 1", format: "physique", addedDate: "2017-10-31", genre: ["Jeu de société"], style: "Monopoly officiel avec plateaux animés Nintendo", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 74, title: "Streets of Rage 4", platform: "Switch 1", format: "physique", addedDate: "2020-04-30", genre: ["Beat'em up"], style: "Beat'em up légendaire ressuscité, art direction saisissante", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 75, title: "Super Mario 3D All-Stars", platform: "Switch 1", format: "physique", addedDate: "2020-09-18", genre: ["Plateforme"], style: "Trilogie 64+Sunshine+Galaxy, édition limitée collector", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 76, title: "Hyrule Warriors Age of Calamity", platform: "Switch 1", format: "physique", addedDate: "2020-11-20", genre: ["Action", "Musou"], style: "Musou Zelda BotW 100 ans avant, hack & slash massif", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 77, title: "Super Mario 3D World Bowser's Fury", platform: "Switch 1", format: "physique", addedDate: "2021-02-12", genre: ["Plateforme", "Multijoueur"], style: "Coop 4 joueurs + mini open world Bowser's Fury original", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 78, title: "Brain Training Nintendo Switch", platform: "Switch 1", format: "physique", addedDate: "2020-07-03", genre: ["Puzzle", "Réflexion"], style: "Jeu de logique Dr. Kawashima, Battle mode multijoueur", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 79, title: "Animal Crossing New Horizons", platform: "Switch 1", format: "physique", addedDate: "2020-03-20", genre: ["Simulation", "Vie"], style: "Île déserte à personnaliser, temps réel, millions d'heures", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 80, title: "Pokemon Legends Arceus", platform: "Switch 1", format: "physique", addedDate: "2022-01-28", genre: ["RPG", "Action", "Open World"], style: "Sinnoh préhistorique, capture en temps réel, Arceus", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 81, title: "TMNT Cowabunga Collection", platform: "Switch 1", format: "physique", addedDate: "2022-08-30", genre: ["Beat'em up"], style: "13 jeux TMNT classiques, arcade à l'état pur", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 82, title: "Sonic Frontiers", platform: "Switch 1", format: "physique", addedDate: "2022-11-08", genre: ["Action", "Open World"], style: "Sonic open world, Starfall Islands, combat amélioré", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 83, title: "The Legend of Zelda Tears of the Kingdom", platform: "Switch 1", format: "physique", addedDate: "2023-05-12", genre: ["Action", "Aventure", "Open World"], style: "Hyrule vertical, Ultrahand + Zonai, suite masterclass", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 84, title: "Sonic Superstars", platform: "Switch 1", format: "physique", addedDate: "2023-10-17", genre: ["Plateforme", "Action"], style: "Sonic 2D 4 persos en coop, îles Northstar, Emerald Powers", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 85, title: "Super Mario Bros Wonder", platform: "Switch 1", format: "physique", addedDate: "2023-10-20", genre: ["Plateforme"], style: "2D Mario révolutionné, Wonder Flowers, 4 joueurs en ligne", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 86, title: "Disney Classic Games Collection", platform: "Switch 1", format: "physique", addedDate: "2023-10-19", genre: ["Plateforme"], style: "Classiques Disney 16-bit remasterisés", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 87, title: "Tomb Raider I-III Remastered", platform: "Switch 1", format: "physique", addedDate: "2024-02-14", genre: ["Action", "Aventure"], style: "Trilogie PS1 Lara Croft remasterisée HD, contrôles modernes", status: "en cours", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 88, title: "Mario vs Donkey Kong", platform: "Switch 1", format: "physique", addedDate: "2024-02-16", genre: ["Puzzle", "Plateforme"], style: "Remake GBA, mini-marios à guider, puzzles mécaniques", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 89, title: "Luigi's Mansion 2 HD", platform: "Switch 1", format: "physique", addedDate: "2024-06-27", genre: ["Action", "Aventure", "Puzzle"], style: "Dark Moon remasterisé, 5 manoirs, Luigi vs Polterpup", status: "non commencé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 90, title: "The Legend of Zelda Echoes of Wisdom", platform: "Switch 1", format: "physique", addedDate: "2024-09-26", genre: ["Action", "Aventure", "Puzzle"], style: "Zelda jouable, mécanique Echos, monde en lambeaux", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 91, title: "Super Mario Party Jamboree", platform: "Switch 1", format: "physique", addedDate: "2024-10-17", genre: ["Jeu de société", "Multijoueur"], style: "Mario Party 22 plateaux, Koopa Troopa Beach, 7 modes", status: "en cours", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 92, title: "Sonic X Shadow Generations", platform: "Switch 1", format: "physique", addedDate: "2024-10-25", genre: ["Plateforme", "Action"], style: "Sonic Generations HD + Shadow Generations inédit", status: "terminé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 93, title: "Mario and Luigi Brothership", platform: "Switch 1", format: "physique", addedDate: "2024-11-07", genre: ["RPG", "Action"], style: "RPG duo Mario & Luigi, combat au tour par tour actionné", status: "non commencé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
  { id: 94, title: "Donkey Kong Country Returns HD", platform: "Switch 1", format: "physique", addedDate: "2025-01-16", genre: ["Plateforme"], style: "Plateforme 2D DK remasterisé, coop Diddy, niveaux délirants", status: "non commencé", note: null, lentA: null, lentDate: null, cover: null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [], myLinks: ["","",""], tips: "", tag: "", progression: "" },
];

const STATUS_COLORS = { "non commencé": "#64748b", "en cours": "#5493FF", "terminé": "#22c55e", "platine": "#a855f7", "abandonné": "#ef4444", "prêté": "#f59e0b" };
const STATUTS = ["non commencé", "en cours", "terminé", "platine", "abandonné", "prêté"];
const PLATFORMS = ["tous", "Xbox Series X", "Xbox One", "Switch 2", "Switch 1"];
// S4 : Series X vert vif (marque Xbox), One vert plus foncé, Switch rouge.
const PLATFORM_COLORS = { "Xbox Series X": "#107C10", "Xbox One": "#0a5c0a", "Switch 2": "#e4000f", "Switch 1": "#e4000f" };

// Rétrocompatibilité : plateforme récente -> plateforme précédente dont les jeux
// marqués backCompat sont aussi jouables dessus. Sert au filtre (platMatch) et à la
// valeur par défaut de backCompat à la création/migration d'un jeu.
const BACK_COMPAT = { "Xbox Series X": "Xbox One", "Switch 2": "Switch 1" };
const BACK_COMPAT_CHILDREN = new Set(Object.values(BACK_COMPAT)); // "Xbox One", "Switch 1"
const isBackCompatPlatform = (p) => BACK_COMPAT_CHILDREN.has(p);
// Plateforme "récente" qui accueille les jeux rétrocompatibles d'une plateforme donnée.
const BACK_COMPAT_PARENT = Object.fromEntries(Object.entries(BACK_COMPAT).map(([parent, child]) => [child, parent]));

// Sépare l'ancienne plateforme "Xbox" en "Xbox One" / "Xbox Series X" selon la date
// (seuil 10/11/2020, sortie Series X ; addedDate sert de proxy de date de sortie).
// Renseigne backCompat (true par défaut pour Xbox One et Switch 1). Pure et idempotente.
//
// bcV = version de migration de backCompat, stockée PAR JEU :
//   v1 (ou absent) : backCompat ne concernait que Xbox One, les Switch 1 valaient false
//   v2             : Switch 1 rétrocompatibles Switch 2 -> rattrapage une seule fois
// Une fois bcV=2 posé, le champ n'est plus jamais forcé : le toggle manuel de la fiche
// (exception au cas par cas) survit donc aux rechargements.
const XBOX_SERIES_CUTOFF = "2020-11-10";
const BACK_COMPAT_VERSION = 2;
function migrateGames(list) {
  return (list || []).map(g => {
    const ng = { ...g };
    if (ng.platform === "Xbox") ng.platform = (ng.addedDate || "") >= XBOX_SERIES_CUTOFF ? "Xbox Series X" : "Xbox One";
    if (ng.backCompat === undefined) ng.backCompat = isBackCompatPlatform(ng.platform);
    else if ((ng.bcV || 1) < 2 && ng.platform === "Switch 1" && ng.backCompat === false) ng.backCompat = true;
    ng.bcV = BACK_COMPAT_VERSION;
    if (ng.infobox === undefined) ng.infobox = null;
    return ng;
  });
}

function fmtTime(mins) {
  if (!mins) return "0h";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h${m > 0 ? m + "m" : ""}` : `${m}m`;
}

// Date de la dernière session jouée, ou null si aucune.
function lastSessionDate(g) {
  const s = g.sessions;
  return s && s.length ? new Date(s[s.length - 1].date) : null;
}
function daysSince(date) { return Math.floor((Date.now() - date) / 86400000); }
// Jeu "en cours" laissé de côté depuis >30j (dernière session, ou date d'ajout en fallback).
function isDusty(g) {
  if (g.status !== "en cours") return false;
  const last = lastSessionDate(g);
  return daysSince(last || new Date(g.addedDate)) > 30;
}
// Ancienneté pour le tri "à finir" : dernière session, sinon date d'ajout.
function staleKey(g) {
  const last = lastSessionDate(g);
  return (last || new Date(g.addedDate)).getTime();
}

// ── Palette ─────────────────────────────────────────────────────────────────
// Les couleurs sont définies dans src/index.css et basculées par l'attribut
// data-theme sur <html>. Ces constantes ne sont que des alias : les styles
// inline continuent de s'écrire `color: txt`, mais la valeur est résolue par
// le navigateur au lieu d'être recalculée à chaque rendu depuis une prop.
const bg = "var(--bg)";        // fond de l'app, des accordéons et du bloc chrono
const hdr = "var(--hdr)";      // en-tête collant
const card = "var(--card)";    // cartes, modales, champs
const bdr = "var(--bdr)";      // toutes les bordures
const txt = "var(--txt)";
const mut = "var(--mut)";
const demat = "var(--demat)";  // fond du badge « démat »

// Jaquette au format boîte de jeu : rectangle vertical ~2:3.
function Cover({ src, title, size = 72 }) {
  const [err, setErr] = useState(false);
  const bg = ["#1a2a4a","#2a1a4a","#1a4a2a","#4a2a1a","#2a4a4a"][title.charCodeAt(0) % 5];
  const isFull = size === "100%";
  const box = isFull
    ? { width: "100%", aspectRatio: "2 / 3", minWidth: 0 }
    : { width: size, height: size * 1.5, minWidth: size };
  if (!src || err) return (
    <div style={{ ...box, background: bg, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isFull ? 40 : size * 0.4 }}>🎮</div>
  );
  return <img src={src} alt={title} onError={() => setErr(true)} style={{ ...box, objectFit: "cover", borderRadius: 8, display: "block" }} />;
}

// Affiche les infos structurées Wikidata (développeur, éditeur, sorties, mode, série).
function InfoboxView({ info }) {
  if (!info) return null;
  const row = (label, val) => val ? <div style={{ fontSize: 11, color: mut, marginBottom: 3, lineHeight: 1.35 }}><span style={{ color: txt, fontWeight: 600 }}>{label} : </span>{val}</div> : null;
  const rel = info.releases?.length ? info.releases.map(r => r.platform ? `${r.date} (${r.platform})` : r.date).join(" · ") : null;
  const serieExtra = [info.follows && `après ${info.follows}`, info.followedBy && `puis ${info.followedBy}`].filter(Boolean).join(", ");
  const serie = info.series ? info.series + (serieExtra ? ` (${serieExtra})` : "") : null;
  return (
    <div>
      {row("Développeur", info.developers?.join(", "))}
      {row("Éditeur", info.publishers?.join(", "))}
      {row("Sortie", rel)}
      {row("Mode", info.modes?.join(", "))}
      {row("Série", serie)}
    </div>
  );
}

function GameCard({ g, onEdit, onDelete, onEnrich, activeTimer, onStartTimer, onStopTimer, autoOpen }) {
  const [open, setOpen] = useState(!!autoOpen);
  const rootRef = useRef(null);
  useEffect(() => { if (autoOpen) rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, []); // eslint-disable-line
  const [loanName, setLoanName] = useState(g.lentA || "");
  const [rawgOpen, setRawgOpen] = useState(false);
  const [rawgQ, setRawgQ] = useState(g.title);
  const [rawgSugg, setRawgSugg] = useState([]);
  const [rawgBusy, setRawgBusy] = useState(false);
  const rawgDebRef = useRef(null);
  const [wikiOpen, setWikiOpen] = useState(false);
  const [wikiQ, setWikiQ] = useState(g.title);
  const [wikiSugg, setWikiSugg] = useState([]);
  const [wikiBusy, setWikiBusy] = useState(false);
  const [wikiDone, setWikiDone] = useState(false);
  const [wikiPicked, setWikiPicked] = useState(null);
  const [wikiExtract, setWikiExtract] = useState(null);
  const [wikiImage, setWikiImage] = useState(null);
  const [wikiInfo, setWikiInfo] = useState(null);
  const [wikiFetching, setWikiFetching] = useState(false);
  const wikiDebRef = useRef(null);
  const [sgdbOpen, setSgdbOpen] = useState(false);
  const [sgdbQ, setSgdbQ] = useState(g.title);
  const [sgdbGridsList, setSgdbGridsList] = useState([]);
  const [sgdbMatch, setSgdbMatch] = useState(null);
  const [sgdbBusy, setSgdbBusy] = useState(false);
  const [sgdbDone, setSgdbDone] = useState(false);
  const sgdbDebRef = useRef(null);
  const [descOpen, setDescOpen] = useState(false);
  const [manH, setManH] = useState(0);
  const [manM, setManM] = useState(0);
  const [, setTick] = useState(0); // force le re-rendu du chrono chaque seconde
  const startRef = useRef(null);
  const isActive = activeTimer === g.id;
  const [section, setSection] = useState(null);
  const toggle = s => setSection(c => c === s ? null : s);

  useEffect(() => {
    if (isActive) { startRef.current = Date.now(); const t = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(t); }
  }, [isActive]);

  const elapsed = isActive && startRef.current ? Math.floor((Date.now() - startRef.current) / 1000) : 0;
  const total = g.playedMinutes + g.manualMinutes;
  const hltbPct = g.hltb && total ? Math.min(100, Math.round(total / (g.hltb * 60) * 100)) : null;
  const dusty = isDusty(g);
  const last = lastSessionDate(g);
  const idleDays = last && g.status === "en cours" ? daysSince(last) : null;
  const baseBorder = dusty ? mut : bdr;

  const rawgQuery = (q) => { setRawgQ(q); clearTimeout(rawgDebRef.current); rawgDebRef.current = setTimeout(async () => setRawgSugg(await rawgSearch(q)), 350); };
  const rawgPick = async (s) => {
    setRawgSugg([]);
    setRawgBusy(true);
    const d = await rawgDetail(s.id);
    if (d) {
      // RAWG fournit cover/metacritic/genre ; la description vient de Wikipédia.
      onEnrich(g.id, {
        cover: d.background_image || g.cover,
        metacritic: d.metacritic ?? g.metacritic,
        genre: d.genres?.map(x => x.name) || g.genre,
      });
    }
    setRawgBusy(false);
    setRawgOpen(false);
  };

  const wikiQuery = (q) => {
    setWikiQ(q);
    setWikiDone(false);
    setWikiPicked(null);
    setWikiExtract(null);
    setWikiImage(null);
    setWikiInfo(null);
    clearTimeout(wikiDebRef.current);
    wikiDebRef.current = setTimeout(async () => {
      setWikiBusy(true);
      const res = await wikiFrenchTitles(q);
      setWikiSugg(res);
      setWikiBusy(false);
      setWikiDone(true);
    }, 350);
  };
  const wikiPick = async (title) => {
    onEdit(g.id, "title", title);
    setWikiPicked(title);
    setWikiSugg([]);
    setWikiExtract(null);
    setWikiImage(null);
    setWikiInfo(null);
    setWikiFetching(true);
    const [{ extract, image }, info] = await Promise.all([wikiArticleData(title), wikidataInfobox(title)]);
    setWikiExtract(extract || null);
    setWikiImage(image || null);
    setWikiInfo(info);
    setWikiFetching(false);
  };

  const sgdbQuery = (q) => {
    setSgdbQ(q);
    setSgdbDone(false);
    clearTimeout(sgdbDebRef.current);
    sgdbDebRef.current = setTimeout(async () => {
      setSgdbBusy(true);
      setSgdbGridsList([]);
      setSgdbMatch(null);
      const results = await sgdbSearch(q);
      const match = results[0] || null;
      setSgdbMatch(match ? match.name : null);
      const grids = match ? await sgdbGrids(match.id) : [];
      setSgdbGridsList(grids);
      setSgdbBusy(false);
      setSgdbDone(true);
    }, 400);
  };
  const sgdbPick = (url) => { onEdit(g.id, "cover", url); setSgdbOpen(false); };

  const acc = (id, title, content) => (
    <div style={{ marginBottom: 8 }}>
      <button onClick={() => toggle(id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", boxSizing: "border-box", background: bg, border: `1px solid ${bdr}`, borderRadius: section === id ? "8px 8px 0 0" : 8, padding: "8px 12px", color: txt, fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
        <span>{title}</span>
        <span style={{ color: mut }}>{section === id ? "▾" : "▸"}</span>
      </button>
      {section === id && <div style={{ background: bg, border: `1px solid ${bdr}`, borderTop: "none", borderRadius: "0 0 8px 8px", padding: "10px 12px" }}>{content}</div>}
    </div>
  );

  return (
    <div ref={rootRef} className="gl-card" style={{ background: card, border: `1px ${dusty ? "dashed" : "solid"} ${baseBorder}`, borderRadius: 12, overflow: "hidden", opacity: dusty ? 0.72 : 1, transition: "border-color 0.2s, opacity 0.2s" }}>

      <div style={{ display: "flex", gap: 10, padding: 12, cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <Cover src={g.cover} title={g.title} size={72} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ background: PLATFORM_COLORS[g.platform] || "#5493FF", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 3, padding: "1px 5px" }}>{g.platform}</span>
            <span key={g.status} style={{ border: `1px solid ${STATUS_COLORS[g.status]}`, color: STATUS_COLORS[g.status], fontSize: 9, borderRadius: 3, padding: "1px 5px", display: "inline-block", animation: "statusPop 200ms ease" }}>{g.status}</span>
            {g.format === "démat" && <span style={{ background: demat, color: "#5493FF", fontSize: 9, borderRadius: 3, padding: "1px 5px" }}>démat</span>}
            {BACK_COMPAT_PARENT[g.platform] && g.backCompat && <span title={`Rétrocompatible ${BACK_COMPAT_PARENT[g.platform]}`} style={{ background: "#107C1022", color: "#22c55e", fontSize: 9, borderRadius: 3, padding: "1px 5px" }}>🔄 Compatible {BACK_COMPAT_PARENT[g.platform].replace("Xbox ", "")}</span>}
            {g.lentA && <span style={{ background: "#7c320044", color: "#f59e0b", fontSize: 9, borderRadius: 3, padding: "1px 5px" }}>📤 {g.lentA}</span>}
            {isActive && <span style={{ background: "#22c55e22", color: "#22c55e", fontSize: 9, borderRadius: 3, padding: "1px 5px" }}>▶ {String(Math.floor(elapsed/60)).padStart(2,"0")}:{String(elapsed%60).padStart(2,"0")}</span>}
          </div>
          <div style={{ fontWeight: 600, fontSize: 13, color: txt, marginBottom: 3 }}>{g.title}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {g.metacritic && <span style={{ color: g.metacritic >= 80 ? "#22c55e" : g.metacritic >= 60 ? "#f59e0b" : "#ef4444", fontSize: 11, fontWeight: 700 }}>MC {g.metacritic}</span>}
            {total > 0 && <span style={{ color: mut, fontSize: 11 }}>{fmtTime(total)}</span>}
            {hltbPct !== null && <span style={{ color: hltbPct >= 100 ? "#22c55e" : "#5493FF", fontSize: 11 }}>{hltbPct}% HLtB</span>}
            {idleDays !== null && <span style={{ color: idleDays > 30 ? "#f59e0b" : mut, fontSize: 11 }}>💤 {idleDays}j depuis dernière session</span>}
          </div>
          {hltbPct !== null && <div style={{ marginTop: 4, height: 3, background: bdr, borderRadius: 2 }}><div style={{ width: `${Math.min(100, hltbPct)}%`, height: "100%", background: hltbPct >= 100 ? "#22c55e" : "#5493FF", borderRadius: 2 }} /></div>}
        </div>
        <span style={{ color: mut, alignSelf: "center" }}>{open ? "▲" : "▼"}</span>
      </div>
      <div style={{ height: 2, background: STATUS_COLORS[g.status] + "66" }} />

      {open && (
        <div style={{ padding: "12px 14px", borderTop: `1px solid ${bdr}` }} onClick={e => e.stopPropagation()}>
          {g.style && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ color: mut, fontSize: 12, fontStyle: "italic", lineHeight: 1.4, ...(descOpen ? {} : { overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }) }}>{g.style}</div>
              {g.style.length > 90 && <button onClick={() => setDescOpen(o => !o)} style={{ background: "transparent", border: "none", color: "#5493FF", fontSize: 10, cursor: "pointer", padding: "2px 0 0", marginTop: 2 }}>{descOpen ? "▴ Réduire" : "▾ Lire la suite"}</button>}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
            {g.genre.map(x => <span key={x} style={{ background: bg, color: mut, fontSize: 10, borderRadius: 4, padding: "2px 7px", border: `1px solid ${bdr}` }}>{x}</span>)}
          </div>

          {/* Infos Wikidata (si présentes) */}
          {g.infobox && (
            <div style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 8, padding: "8px 10px", marginBottom: 12 }}>
              <InfoboxView info={g.infobox} />
            </div>
          )}

          {/* Statut */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
            {STATUTS.map(s => <button key={s} onClick={() => onEdit(g.id, "status", s)} style={{ background: g.status === s ? STATUS_COLORS[s] + "33" : "transparent", border: `1px solid ${g.status === s ? STATUS_COLORS[s] : bdr}`, color: g.status === s ? STATUS_COLORS[s] : mut, borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>{s}</button>)}
          </div>

          {/* Format physique / démat */}
          <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 12 }}>
            <span style={{ color: mut, fontSize: 11 }}>Format :</span>
            {["physique", "démat"].map(f => <button key={f} onClick={() => onEdit(g.id, "format", f)} style={{ background: g.format === f ? "#5493FF22" : "transparent", border: `1px solid ${g.format === f ? "#5493FF" : bdr}`, color: g.format === f ? "#5493FF" : mut, borderRadius: 5, padding: "3px 10px", fontSize: 10, cursor: "pointer" }}>{f}</button>)}
          </div>

          {/* Rétrocompatibilité : exception au cas par cas (jeux Xbox One / Switch 1) */}
          {BACK_COMPAT_PARENT[g.platform] && (
            <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ color: mut, fontSize: 11 }}>Jouable sur {BACK_COMPAT_PARENT[g.platform]} :</span>
              {[["oui", true], ["non", false]].map(([label, val]) => (
                <button key={label} onClick={() => onEdit(g.id, "backCompat", val)}
                  style={{ background: !!g.backCompat === val ? (val ? "#22c55e22" : "#ef444422") : "transparent", border: `1px solid ${!!g.backCompat === val ? (val ? "#22c55e" : "#ef4444") : bdr}`, color: !!g.backCompat === val ? (val ? "#22c55e" : "#ef4444") : mut, borderRadius: 5, padding: "3px 10px", fontSize: 10, cursor: "pointer" }}>{label}</button>
              ))}
            </div>
          )}

          {/* Chrono */}
          <div style={{ background: bg, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: txt, fontSize: 12, fontWeight: 600 }}>Temps de jeu</span>
              <span style={{ color: "#5493FF", fontSize: 12, fontWeight: 700 }}>{fmtTime(total)}{g.hltb ? ` / ${g.hltb}h` : ""}</span>
            </div>
            <button onClick={() => isActive ? onStopTimer(g.id) : onStartTimer(g.id)} style={{ background: isActive ? "#ef444422" : "#22c55e22", border: `1px solid ${isActive ? "#ef4444" : "#22c55e"}`, color: isActive ? "#ef4444" : "#22c55e", borderRadius: 6, padding: "5px 14px", fontSize: 12, cursor: "pointer", fontWeight: 600, marginBottom: 8 }}>
              {isActive ? `⏹ Stop (${String(Math.floor(elapsed/60)).padStart(2,"0")}:${String(elapsed%60).padStart(2,"0")})` : "▶ Jouer"}
            </button>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ color: mut, fontSize: 11 }}>Déjà joué :</span>
              <input type="number" min="0" value={manH || ""} placeholder="0" onChange={e => setManH(Math.max(0, parseInt(e.target.value, 10) || 0))} style={{ width: 42, background: "transparent", border: `1px solid ${bdr}`, borderRadius: 4, color: txt, padding: "2px 4px", fontSize: 11 }} />
              <span style={{ color: mut, fontSize: 11 }}>h</span>
              <input type="number" min="0" max="59" value={manM || ""} placeholder="0" onChange={e => setManM(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))} style={{ width: 38, background: "transparent", border: `1px solid ${bdr}`, borderRadius: 4, color: txt, padding: "2px 4px", fontSize: 11 }} />
              <span style={{ color: mut, fontSize: 11 }}>m</span>
              <button onClick={() => { const add = manH * 60 + manM; if (add <= 0) return; onEdit(g.id, "manualMinutes", (g.manualMinutes || 0) + add); setManH(0); setManM(0); }} style={{ background: "#5493FF22", border: "1px solid #5493FF", color: "#5493FF", borderRadius: 4, padding: "2px 8px", fontSize: 11, cursor: "pointer" }}>+</button>
              <button onClick={() => { const sub = manH * 60 + manM; if (sub <= 0) return; onEdit(g.id, "manualMinutes", Math.max(0, (g.manualMinutes || 0) - sub)); setManH(0); setManM(0); }} style={{ background: "#ef444422", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 4, padding: "2px 8px", fontSize: 11, cursor: "pointer" }}>−</button>
            </div>
            {g.sessions.slice(-3).reverse().map((s, i) => <div key={i} style={{ color: mut, fontSize: 10, marginTop: 4 }}>{new Date(s.date).toLocaleDateString("fr-FR")} — {fmtTime(s.minutes)}</div>)}
          </div>

          {/* Prêt (accordéon) */}
          {acc("loan", "📤 Prêt", (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: mut, fontSize: 11 }}>Prêté à :</span>
                <input value={loanName} onChange={e => setLoanName(e.target.value)} placeholder="Nom…" style={{ flex: 1, background: "transparent", border: `1px solid ${bdr}`, borderRadius: 6, color: txt, padding: "4px 8px", fontSize: 12, outline: "none" }} />
                <button onClick={() => { onEdit(g.id, "lentA", loanName || null); onEdit(g.id, "lentDate", loanName ? new Date().toISOString().slice(0,10) : null); if (loanName) onEdit(g.id, "status", "prêté"); }} style={{ background: "#f59e0b22", border: "1px solid #f59e0b", color: "#f59e0b", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>OK</button>
              </div>
              {g.lentDate && <div style={{ color: mut, fontSize: 10, marginTop: 6 }}>Prêté le {new Date(g.lentDate).toLocaleDateString("fr-FR")}</div>}
            </>
          ))}

          {/* Liens & contenu (accordéon) */}
          {acc("links", "🔗 Liens & contenu", (
            <>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(g.title + " official trailer")}`} target="_blank" rel="noreferrer" style={{ background: "#ef444422", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 5, padding: "3px 8px", fontSize: 10, textDecoration: "none" }}>▶ Trailer</a>
                <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(g.title + " gameplay français")}`} target="_blank" rel="noreferrer" style={{ background: "#ef444422", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 5, padding: "3px 8px", fontSize: 10, textDecoration: "none" }}>▶ Gameplay FR</a>
                <a href={`https://www.jeuxvideo.com/recherche/?q=${encodeURIComponent(g.title)}`} target="_blank" rel="noreferrer" style={{ background: "#5493FF22", border: "1px solid #5493FF", color: "#5493FF", borderRadius: 5, padding: "3px 8px", fontSize: 10, textDecoration: "none" }}>JVC</a>
                <a href={`https://www.ign.com/search?q=${encodeURIComponent(g.title)}`} target="_blank" rel="noreferrer" style={{ background: "#5493FF22", border: "1px solid #5493FF", color: "#5493FF", borderRadius: 5, padding: "3px 8px", fontSize: 10, textDecoration: "none" }}>IGN</a>
              </div>
              {[0,1,2].map(i => (
                <input key={i} value={g.myLinks[i] || ""} onChange={e => { const l = [...g.myLinks]; l[i] = e.target.value; onEdit(g.id, "myLinks", l); }}
                  placeholder={["Lien soluce…","Lien wiki…","Ma playlist YouTube…"][i]}
                  style={{ display: "block", width: "100%", background: "transparent", border: `1px solid ${bdr}`, borderRadius: 6, color: txt, padding: "4px 8px", fontSize: 11, outline: "none", marginBottom: 4, boxSizing: "border-box" }} />
              ))}
              {g.myLinks.filter(Boolean).map((url, i) => <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: "block", color: "#5493FF", fontSize: 10, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</a>)}
            </>
          ))}

          {/* Notes (accordéon) */}
          {acc("notes", "📝 Notes", (
            <textarea value={g.tips || ""} onChange={e => onEdit(g.id, "tips", e.target.value)} placeholder="Notes & tips perso…" rows={2} style={{ width: "100%", background: "transparent", border: `1px solid ${bdr}`, borderRadius: 6, color: txt, padding: "6px 8px", fontSize: 11, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
          ))}
          {/* Re-association RAWG */}
          {rawgOpen && (
            <div style={{ position: "relative", background: bg, border: `1px solid ${bdr}`, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
              <div style={{ color: txt, fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Ré-associer depuis RAWG</div>
              <input value={rawgQ} onChange={e => rawgQuery(e.target.value)} placeholder="Titre du jeu…" autoFocus style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: `1px solid ${bdr}`, borderRadius: 6, color: txt, padding: "6px 8px", fontSize: 12, outline: "none" }} />
              {rawgBusy && <div style={{ color: "#5493FF", fontSize: 11, marginTop: 4 }}>Récupération & traduction…</div>}
              {rawgSugg.length > 0 && !rawgBusy && (
                <div style={{ marginTop: 6, background: card, border: `1px solid ${bdr}`, borderRadius: 8, maxHeight: 300, overflowY: "auto", boxShadow: "0 8px 24px #0008" }}>
                  {rawgSugg.map(s => (
                    <div key={s.id} className="gl-row" onClick={() => rawgPick(s)} style={{ display: "flex", gap: 8, padding: "7px 9px", cursor: "pointer", borderBottom: `1px solid ${bdr}`, alignItems: "center" }}>
                      {s.background_image && <img src={s.background_image} style={{ width: 34, height: 51, minWidth: 34, objectFit: "cover", borderRadius: 4 }} />}
                      <div style={{ minWidth: 0 }}><div style={{ color: txt, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div><div style={{ color: mut, fontSize: 10 }}>{s.released}{s.metacritic ? ` · MC ${s.metacritic}` : ""}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Titre français via Wikipédia FR */}
          {wikiOpen && (
            <div style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
              <div style={{ color: txt, fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Titre français (Wikipédia)</div>
              <input value={wikiQ} onChange={e => wikiQuery(e.target.value)} placeholder="Titre du jeu…" autoFocus style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: `1px solid ${bdr}`, borderRadius: 6, color: txt, padding: "6px 8px", fontSize: 12, outline: "none" }} />
              {wikiBusy && <div style={{ color: "#5493FF", fontSize: 11, marginTop: 4 }}>Recherche…</div>}
              {!wikiBusy && wikiSugg.length > 0 && (
                <div style={{ marginTop: 6, background: card, border: `1px solid ${bdr}`, borderRadius: 8, maxHeight: 300, overflowY: "auto", boxShadow: "0 8px 24px #0008" }}>
                  {wikiSugg.map((s, i) => (
                    <div key={i} className="gl-row" style={{ display: "flex", gap: 8, padding: "7px 9px", borderBottom: `1px solid ${bdr}`, alignItems: "center" }}>
                      <div onClick={() => wikiPick(s.title)} style={{ flex: 1, minWidth: 0, cursor: "pointer", color: txt, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                      {s.url && <a href={s.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} title="Voir la page Wikipédia" style={{ color: "#5493FF", fontSize: 10, textDecoration: "none", flexShrink: 0 }}>↗ page</a>}
                    </div>
                  ))}
                </div>
              )}
              {!wikiBusy && wikiDone && wikiSugg.length === 0 && !wikiPicked && <div style={{ color: mut, fontSize: 11, marginTop: 6 }}>Aucun titre français trouvé</div>}

              {wikiFetching && <div style={{ color: "#5493FF", fontSize: 11, marginTop: 8 }}>Chargement de la fiche Wikipédia…</div>}

              {/* Résumé Wikipédia */}
              {wikiExtract && (
                <div style={{ marginTop: 10, borderTop: `1px solid ${bdr}`, paddingTop: 8 }}>
                  <div style={{ color: txt, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Résumé Wikipédia</div>
                  <div style={{ color: mut, fontSize: 11, fontStyle: "italic", lineHeight: 1.4, maxHeight: 96, overflowY: "auto", marginBottom: 6 }}>{wikiExtract}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => { onEdit(g.id, "style", wikiExtract); setWikiExtract(null); }} style={{ background: "#22c55e22", border: "1px solid #22c55e", color: "#22c55e", borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>Utiliser ce résumé</button>
                    <button onClick={() => setWikiExtract(null)} style={{ background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>Garder la description actuelle</button>
                  </div>
                </div>
              )}

              {/* Jaquette Wikipédia */}
              {wikiImage && (
                <div style={{ marginTop: 10, borderTop: `1px solid ${bdr}`, paddingTop: 8 }}>
                  <div style={{ color: txt, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Jaquette Wikipédia</div>
                  <img src={wikiImage} alt="" style={{ maxWidth: 120, maxHeight: 160, objectFit: "contain", borderRadius: 6, border: `1px solid ${bdr}`, display: "block", marginBottom: 6 }} />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => { onEdit(g.id, "cover", wikiImage); setWikiImage(null); }} style={{ background: "#22c55e22", border: "1px solid #22c55e", color: "#22c55e", borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>Utiliser cette jaquette</button>
                    <button onClick={() => setWikiImage(null)} style={{ background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>Garder la jaquette actuelle</button>
                  </div>
                </div>
              )}

              {/* Infos Wikidata */}
              {wikiInfo && (
                <div style={{ marginTop: 10, borderTop: `1px solid ${bdr}`, paddingTop: 8 }}>
                  <div style={{ color: txt, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>ℹ️ Infos (Wikidata)</div>
                  <div style={{ marginBottom: 6 }}><InfoboxView info={wikiInfo} /></div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => { onEdit(g.id, "infobox", wikiInfo); setWikiInfo(null); }} style={{ background: "#22c55e22", border: "1px solid #22c55e", color: "#22c55e", borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>Utiliser ces infos</button>
                    <button onClick={() => setWikiInfo(null)} style={{ background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>Ignorer</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Jaquettes SteamGridDB */}
          {sgdbOpen && (
            <div style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
              <div style={{ color: txt, fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Jaquette SteamGridDB</div>
              <input value={sgdbQ} onChange={e => sgdbQuery(e.target.value)} placeholder="Titre du jeu…" autoFocus style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: `1px solid ${bdr}`, borderRadius: 6, color: txt, padding: "6px 8px", fontSize: 12, outline: "none" }} />
              {sgdbBusy && <div style={{ color: "#5493FF", fontSize: 11, marginTop: 6 }}>Recherche des jaquettes…</div>}
              {!sgdbBusy && sgdbGridsList.length > 0 && (
                <>
                  {sgdbMatch && <div style={{ color: mut, fontSize: 11, marginTop: 6 }}>Trouvé : <span style={{ color: txt, fontWeight: 600 }}>{sgdbMatch}</span></div>}
                  <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                    {sgdbGridsList.map((grid, i) => (
                      <img key={i} className="gl-thumb" src={grid.thumb} alt="" loading="lazy" onClick={() => sgdbPick(grid.url)} title="Utiliser cette jaquette"
                        style={{ width: "100%", aspectRatio: "2 / 3", objectFit: "cover", borderRadius: 6, border: `1px solid ${bdr}`, cursor: "pointer", display: "block" }} />
                    ))}
                  </div>
                </>
              )}
              {!sgdbBusy && sgdbDone && sgdbGridsList.length === 0 && <div style={{ color: mut, fontSize: 11, marginTop: 6 }}>Aucune jaquette trouvée sur SteamGridDB</div>}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ color: mut, fontSize: 10 }}>Ajouté le {new Date(g.addedDate).toLocaleDateString("fr-FR")}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button onClick={() => { setRawgOpen(o => !o); if (!rawgOpen) { setRawgQ(g.title); rawgQuery(g.title); } }} style={{ background: "transparent", border: "1px solid #5493FF", color: "#5493FF", borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>🔄 Rechercher sur RAWG</button>
              <button onClick={() => { setWikiOpen(o => !o); if (!wikiOpen) { setWikiQ(g.title); setWikiDone(false); wikiQuery(g.title); } }} style={{ background: "transparent", border: "1px solid #5493FF", color: "#5493FF", borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>🇫🇷 Titre français</button>
              <button onClick={() => { setSgdbOpen(o => !o); if (!sgdbOpen) { setSgdbQ(g.title); setSgdbDone(false); sgdbQuery(g.title); } }} style={{ background: "transparent", border: "1px solid #5493FF", color: "#5493FF", borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>📦 Jaquette SteamGridDB</button>
              <button onClick={() => onDelete(g)} style={{ background: "transparent", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddModal({ onAdd, onClose }) {
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("Xbox Series X");
  const [fmt, setFmt] = useState("physique");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("non commencé");
  const [loading, setLoading] = useState(false);
  const [sugg, setSugg] = useState([]);
  const [rawg, setRawg] = useState(null);
  const debRef = useRef(null);
  // Wikipédia (titre + description)
  const [wikiOpen, setWikiOpen] = useState(false);
  const [wikiSugg, setWikiSugg] = useState([]);
  const [wikiBusy, setWikiBusy] = useState(false);
  const [wikiDone, setWikiDone] = useState(false);
  const [wikiExtract, setWikiExtract] = useState("");
  const [wikiInfo, setWikiInfo] = useState(null);
  const wikiDebRef = useRef(null);
  // SteamGridDB (jaquette)
  const [sgOpen, setSgOpen] = useState(false);
  const [sgGrids, setSgGrids] = useState([]);
  const [sgBusy, setSgBusy] = useState(false);
  const [sgDone, setSgDone] = useState(false);
  const [sgMatch, setSgMatch] = useState(null);
  const [cover, setCover] = useState(null);
  const sgDebRef = useRef(null);

  const inp = { background: bg, border: `1px solid ${bdr}`, borderRadius: 8, color: txt, padding: "8px 12px", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
  const srcBtn = { background: "transparent", border: "1px solid #5493FF", color: "#5493FF", borderRadius: 6, padding: "5px 8px", fontSize: 11, cursor: "pointer" };

  const search = async (q) => setSugg(await rawgSearch(q));

  const pick = async (game) => {
    setTitle(game.name);
    setSugg([]);
    setLoading(true);
    const d = await rawgDetail(game.id);
    if (d) {
      setRawg(d);
      if (d.released) setDate(d.released);
      if (!cover && d.background_image) setCover(d.background_image);
    }
    setLoading(false);
  };

  // Wikipédia
  const wikiQuery = (q) => {
    setWikiDone(false);
    clearTimeout(wikiDebRef.current);
    wikiDebRef.current = setTimeout(async () => {
      setWikiBusy(true);
      setWikiSugg(await wikiFrenchTitles(q));
      setWikiBusy(false);
      setWikiDone(true);
    }, 350);
  };
  const wikiPick = async (t) => {
    setTitle(t);
    setWikiSugg([]);
    setWikiBusy(true);
    const [{ extract }, info] = await Promise.all([wikiArticleData(t), wikidataInfobox(t)]);
    setWikiExtract(extract || "");
    setWikiInfo(info);
    setWikiBusy(false);
  };

  // SteamGridDB
  const sgQuery = (q) => {
    setSgDone(false);
    clearTimeout(sgDebRef.current);
    sgDebRef.current = setTimeout(async () => {
      setSgBusy(true);
      setSgGrids([]);
      setSgMatch(null);
      const results = await sgdbSearch(q);
      const match = results[0] || null;
      setSgMatch(match ? match.name : null);
      setSgGrids(match ? await sgdbGrids(match.id) : []);
      setSgBusy(false);
      setSgDone(true);
    }, 400);
  };

  const handleAdd = () => {
    if (!title.trim()) return;
    onAdd({
      id: Date.now(), title: title.trim(), platform, format: fmt,
      addedDate: date || new Date().toISOString().slice(0, 10),
      genre: rawg?.genres?.map(g => g.name) || [],
      style: wikiExtract || "",
      status, note: null, lentA: null, lentDate: null,
      cover: cover || rawg?.background_image || null,
      metacritic: rawg?.metacritic || null,
      hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [],
      myLinks: ["","",""], tips: "", tag: "", progression: "",
      backCompat: isBackCompatPlatform(platform), infobox: wikiInfo || null,
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000b", zIndex: 300, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: "16px 16px 0 0", padding: "20px 20px calc(20px + var(--safe-bottom))", width: "100%", maxWidth: 500, margin: "0 auto", maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 15, color: txt, marginBottom: 14 }}>Ajouter un jeu</div>

        <div style={{ position: "relative", marginBottom: 10 }}>
          <input value={title} onChange={e => { setTitle(e.target.value); clearTimeout(debRef.current); debRef.current = setTimeout(() => search(e.target.value), 350); }} placeholder="Titre du jeu *" style={inp} />
          {loading && <div style={{ color: "#5493FF", fontSize: 11, marginTop: 3 }}>Recherche RAWG…</div>}
          {sugg.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: card, border: `1px solid ${bdr}`, borderRadius: 8, zIndex: 10, overflow: "hidden", boxShadow: "0 8px 24px #0008" }}>
              {sugg.map(s => (
                <div key={s.id} className="gl-row" onClick={() => pick(s)} style={{ display: "flex", gap: 8, padding: "8px 10px", cursor: "pointer", borderBottom: `1px solid ${bdr}` }}>
                  {s.background_image && <img src={s.background_image} style={{ width: 34, height: 51, minWidth: 34, objectFit: "cover", borderRadius: 4 }} />}
                  <div><div style={{ color: txt, fontSize: 12, fontWeight: 600 }}>{s.name}</div><div style={{ color: "#64748b", fontSize: 10 }}>{s.released}{s.metacritic ? ` · MC ${s.metacritic}` : ""}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Récap des sources choisies */}
        {(cover || rawg || wikiExtract) && (
          <div style={{ background: card, borderRadius: 8, padding: "8px 10px", marginBottom: 10, display: "flex", gap: 10 }}>
            {cover && <img src={cover} style={{ width: 40, height: 60, minWidth: 40, objectFit: "cover", borderRadius: 6 }} />}
            <div style={{ minWidth: 0 }}>
              {rawg && <div style={{ color: mut, fontSize: 10 }}>{rawg.genres?.map(g => g.name).join(", ")}{rawg.metacritic ? ` · MC ${rawg.metacritic}` : ""}</div>}
              {wikiExtract && <div style={{ color: mut, fontSize: 10, marginTop: 2, maxHeight: 40, overflow: "hidden" }}>📝 {wikiExtract.slice(0, 90)}…</div>}
              {!wikiExtract && !rawg && cover && <div style={{ color: mut, fontSize: 10 }}>Jaquette sélectionnée</div>}
            </div>
          </div>
        )}

        {/* Sources : Wikipédia + SteamGridDB */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <button onClick={() => { setWikiOpen(o => !o); if (!wikiOpen && title.trim()) { setWikiDone(false); wikiQuery(title); } }} style={srcBtn}>🇫🇷 Wikipédia (titre + desc.)</button>
          <button onClick={() => { setSgOpen(o => !o); if (!sgOpen && title.trim()) { setSgDone(false); sgQuery(title); } }} style={srcBtn}>📦 Jaquette SteamGridDB</button>
        </div>

        {wikiOpen && (
          <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
            <div style={{ color: txt, fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Titre + description (Wikipédia)</div>
            <input defaultValue={title} onChange={e => wikiQuery(e.target.value)} placeholder="Titre du jeu…" style={{ ...inp, fontSize: 12, padding: "6px 8px" }} />
            {wikiBusy && <div style={{ color: "#5493FF", fontSize: 11, marginTop: 4 }}>Recherche…</div>}
            {!wikiBusy && wikiSugg.length > 0 && (
              <div style={{ marginTop: 6, background: bg, border: `1px solid ${bdr}`, borderRadius: 8, maxHeight: 260, overflowY: "auto" }}>
                {wikiSugg.map((s, i) => (
                  <div key={i} className="gl-row" style={{ display: "flex", gap: 8, padding: "7px 9px", borderBottom: `1px solid ${bdr}`, alignItems: "center" }}>
                    <div onClick={() => wikiPick(s.title)} style={{ flex: 1, minWidth: 0, cursor: "pointer", color: txt, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                    {s.url && <a href={s.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: "#5493FF", fontSize: 10, textDecoration: "none", flexShrink: 0 }}>↗</a>}
                  </div>
                ))}
              </div>
            )}
            {!wikiBusy && wikiDone && wikiSugg.length === 0 && <div style={{ color: mut, fontSize: 11, marginTop: 6 }}>Aucun résultat Wikipédia</div>}
          </div>
        )}

        {sgOpen && (
          <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
            <div style={{ color: txt, fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Jaquette SteamGridDB</div>
            <input defaultValue={title} onChange={e => sgQuery(e.target.value)} placeholder="Titre du jeu…" style={{ ...inp, fontSize: 12, padding: "6px 8px" }} />
            {sgBusy && <div style={{ color: "#5493FF", fontSize: 11, marginTop: 6 }}>Recherche des jaquettes…</div>}
            {!sgBusy && sgGrids.length > 0 && (
              <>
                {sgMatch && <div style={{ color: mut, fontSize: 11, marginTop: 6 }}>Trouvé : <span style={{ color: txt, fontWeight: 600 }}>{sgMatch}</span></div>}
                <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, maxHeight: 300, overflowY: "auto" }}>
                  {sgGrids.map((grid, i) => (
                    <img key={i} src={grid.thumb} alt="" loading="lazy" onClick={() => { setCover(grid.url); setSgOpen(false); }} title="Choisir cette jaquette"
                      style={{ width: "100%", aspectRatio: "2 / 3", objectFit: "cover", borderRadius: 6, border: cover === grid.url ? "2px solid #5493FF" : `1px solid ${bdr}`, cursor: "pointer", display: "block" }} />
                  ))}
                </div>
              </>
            )}
            {!sgBusy && sgDone && sgGrids.length === 0 && <div style={{ color: mut, fontSize: 11, marginTop: 6 }}>Aucune jaquette trouvée sur SteamGridDB</div>}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <select value={platform} onChange={e => setPlatform(e.target.value)} style={{ ...inp, flex: 1 }}>{PLATFORMS.filter(p => p !== "tous").map(p => <option key={p}>{p}</option>)}</select>
          <select value={fmt} onChange={e => setFmt(e.target.value)} style={{ ...inp, flex: 1 }}><option>physique</option><option>démat</option></select>
        </div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, marginBottom: 10 }} />
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inp, marginBottom: 14 }}>{STATUTS.map(s => <option key={s}>{s}</option>)}</select>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, background: "transparent", border: `1px solid ${bdr}`, color: "#94a3b8", borderRadius: 8, padding: 10, cursor: "pointer", fontSize: 13 }}>Annuler</button>
          <button onClick={handleAdd} style={{ flex: 2, background: "#5493FF", border: "none", color: "#fff", borderRadius: 8, padding: 10, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Ajouter</button>
        </div>
      </div>
    </div>
  );
}

// Import de la bibliothèque Xbox (xbl.io) avec écran de prévisualisation.
function ImportModal({ games, onImportGames, onClose }) {
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const cancelRef = useRef(false);

  useEffect(() => {
    (async () => {
      const raw = await xblTitleHistory();
      const existing = new Set(games.map(g => normTitle(g.title)));
      // dédoublonne aussi la liste xbl elle-même (par titre normalisé)
      const seen = new Set();
      const enriched = [];
      for (const t of raw) {
        const key = normTitle(t.name);
        if (seen.has(key)) continue;
        seen.add(key);
        enriched.push({ ...t, isNew: !existing.has(key) });
      }
      enriched.sort((a, b) => (a.isNew === b.isNew ? a.name.localeCompare(b.name) : a.isNew ? -1 : 1));
      const init = {};
      enriched.forEach(t => { if (t.isNew) init[t.name] = true; });
      setList(enriched);
      setChecked(init);
      setLoading(false);
    })();
  }, []); // eslint-disable-line

  const newOnes = list ? list.filter(t => t.isNew) : [];
  const existingCount = list ? list.length - newOnes.length : 0;
  const selectedCount = Object.values(checked).filter(Boolean).length;
  const allChecked = newOnes.length > 0 && newOnes.every(t => checked[t.name]);
  const toggleAll = () => { const v = !allChecked; const c = {}; newOnes.forEach(t => c[t.name] = v); setChecked(c); };

  const doImport = async () => {
    const selected = list.filter(t => t.isNew && checked[t.name]);
    if (!selected.length) return;
    setImporting(true);
    cancelRef.current = false;
    setProgress(0);
    const created = [];
    for (let i = 0; i < selected.length; i++) {
      if (cancelRef.current) break;
      const t = selected[i];
      // Date d'ajout = date de sortie officielle (croisement RAWG), fallback lastPlayed / aujourd'hui.
      let released = null;
      try { const res = await rawgSearch(t.name); released = res[0]?.released || null; } catch {}
      const addedDate = released || (t.lastPlayed ? t.lastPlayed.slice(0, 10) : new Date().toISOString().slice(0, 10));
      const platform = addedDate >= XBOX_SERIES_CUTOFF ? "Xbox Series X" : "Xbox One";
      created.push({
        id: Date.now() + i, title: t.name, platform, format: "démat", addedDate,
        genre: [], style: "", status: "non commencé", note: null, lentA: null, lentDate: null,
        cover: t.image || null, metacritic: null, hltb: null, playedMinutes: 0, manualMinutes: 0,
        sessions: [], myLinks: ["", "", ""], tips: "", tag: "", progression: "",
        backCompat: isBackCompatPlatform(platform), infobox: null,
      });
      setProgress(i + 1);
      await new Promise(r => setTimeout(r, 200)); // ménage le rate-limit RAWG
    }
    onImportGames(created);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000b", zIndex: 300, display: "flex", alignItems: "flex-end" }} onClick={importing ? undefined : onClose}>
      <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: "16px 16px 0 0", padding: "20px 20px calc(20px + var(--safe-bottom))", width: "100%", maxWidth: 500, margin: "0 auto", maxHeight: "85vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 15, color: txt, marginBottom: 4 }}>🎮 Importer ma bibliothèque Xbox</div>
        {loading && <div style={{ color: "#5493FF", fontSize: 12, padding: "16px 0" }}>Récupération de l'historique Xbox…</div>}

        {!loading && list && (
          <>
            <div style={{ color: mut, fontSize: 11, marginBottom: 10 }}>
              {newOnes.length} nouveau(x) · {existingCount} déjà présent(s) · {list.length} jeux Xbox détectés
            </div>
            {newOnes.length > 0 && (
              <button onClick={toggleAll} disabled={importing} style={{ alignSelf: "flex-start", background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer", marginBottom: 8 }}>
                {allChecked ? "Tout décocher" : "Tout cocher"}
              </button>
            )}
            <div style={{ overflowY: "auto", flex: 1, border: `1px solid ${bdr}`, borderRadius: 8, marginBottom: 12 }}>
              {list.map((t, i) => (
                <label key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 9px", borderBottom: i < list.length - 1 ? `1px solid ${bdr}` : "none", cursor: t.isNew ? "pointer" : "default", opacity: t.isNew ? 1 : 0.5 }}>
                  <input type="checkbox" disabled={!t.isNew || importing} checked={!!checked[t.name]} onChange={e => setChecked(c => ({ ...c, [t.name]: e.target.checked }))} style={{ accentColor: "#5493FF" }} />
                  {t.image && <img src={t.image} alt="" style={{ width: 30, height: 45, minWidth: 30, objectFit: "cover", borderRadius: 3 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: txt, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                    <div style={{ color: mut, fontSize: 9 }}>{t.devices.join(", ")}</div>
                  </div>
                  <span style={{ fontSize: 9, color: t.isNew ? "#22c55e" : mut, border: `1px solid ${t.isNew ? "#22c55e" : bdr}`, borderRadius: 3, padding: "1px 5px", whiteSpace: "nowrap" }}>{t.isNew ? "Nouveau" : "Déjà présent"}</span>
                </label>
              ))}
            </div>
            {importing && <div style={{ color: "#5493FF", fontSize: 11, marginBottom: 8 }}>Import en cours… {progress}/{selectedCount} (récupération des dates de sortie)</div>}
            <div style={{ display: "flex", gap: 8 }}>
              {!importing
                ? <>
                    <button onClick={onClose} style={{ flex: 1, background: "transparent", border: `1px solid ${bdr}`, color: "#94a3b8", borderRadius: 8, padding: 10, cursor: "pointer", fontSize: 13 }}>Annuler</button>
                    <button onClick={doImport} disabled={selectedCount === 0} style={{ flex: 2, background: "#5493FF", border: "none", color: "#fff", borderRadius: 8, padding: 10, cursor: selectedCount ? "pointer" : "default", opacity: selectedCount ? 1 : 0.5, fontSize: 13, fontWeight: 600 }}>Importer {selectedCount} jeu(x)</button>
                  </>
                : <button onClick={() => { cancelRef.current = true; }} style={{ flex: 1, background: "#ef444422", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 8, padding: 10, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Arrêter l'import</button>}
            </div>
          </>
        )}

        {!loading && list && list.length === 0 && (
          <div style={{ color: mut, fontSize: 12, padding: "8px 0 16px" }}>Aucun jeu Xbox détecté (ou connexion xbl.io indisponible).</div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [games, setGames] = useState(() => { try { const s = localStorage.getItem("gl_v2"); return migrateGames(s ? JSON.parse(s) : GAMES_INIT); } catch { return migrateGames(GAMES_INIT); } });
  const [search, setSearch] = useState("");
  const [plat, setPlat] = useState("tous");
  const [statFil, setStatFil] = useState("tous");
  const [fmtFil, setFmtFil] = useState("tous");
  const [sort, setSort] = useState("titre");
  const [view, setView] = useState("liste");
  const [tab, setTab] = useState("library");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [keys, setKeys] = useState(() => loadKeys());   // clés API saisies par l'utilisateur
  const [showKeys, setShowKeys] = useState(false);      // afficher/masquer les valeurs
  const [keyTest, setKeyTest] = useState({});           // résultat du bouton « Tester »
  const [savedMsg, setSavedMsg] = useState(false);      // confirmation d'enregistrement
  const [importedIds, setImportedIds] = useState([]); // pour l'enrichissement post-import (E)
  const [enriching, setEnriching] = useState(false);
  const [enrichProg, setEnrichProg] = useState(0);
  const enrichCancelRef = useRef(false);
  const [lastAddedId, setLastAddedId] = useState(null);
  const [activeTimer, setActiveTimer] = useState(null);
  const [timerStart, setTimerStart] = useState(null);
  // Le thème est persisté : il repartait en sombre à chaque rechargement.
  // index.html le pose sur <html> avant le premier rendu pour éviter le clignotement.
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("gl_theme") === "light" ? "light" : "dark"; } catch { return "dark"; }
  });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProg, setRefreshProg] = useState(0);
  const [refreshMsg, setRefreshMsg] = useState(null); // bilan de fin de refresh (S1)
  const refreshCancelRef = useRef(false); // annulation du refresh global (S6)
  const [deleted, setDeleted] = useState(null); // { game, index } pour l'undo
  const undoRef = useRef(null);
  const importRef = useRef(null);

  useEffect(() => { try { localStorage.setItem("gl_v2", JSON.stringify(games)); } catch {} }, [games]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("gl_theme", theme); } catch {}
  }, [theme]);

  // Actualise la description de tous les jeux depuis Wikipédia FR :
  // recherche full-text -> résumé (extract) du 1er article -> champ style.
  // Annulable (S6) ; garde un délai anti-rate-limit ; log des jeux sans page (S1).
  const refreshAllDescriptions = async () => {
    if (refreshing) return;
    refreshCancelRef.current = false;
    setRefreshing(true);
    setRefreshProg(0);
    setRefreshMsg(null);
    const list = [...games];
    const notFound = [];
    let done = 0;
    for (let i = 0; i < list.length; i++) {
      if (refreshCancelRef.current) break;
      const g = list[i];
      try {
        const titles = await wikiFrenchTitles(g.title);
        const best = pickBestWikiTitle(g.title, titles);
        const { extract } = best ? await wikiArticleData(best.title) : { extract: "" };
        if (extract) { setGames(gs => gs.map(x => x.id === g.id ? { ...x, style: extract } : x)); done++; }
        else notFound.push(g.title);
      } catch { notFound.push(g.title); }
      setRefreshProg(i + 1);
      await new Promise(res => setTimeout(res, 150));
    }
    setRefreshing(false);
    const stopped = refreshCancelRef.current;
    setRefreshMsg({
      done, total: list.length, notFound, stopped,
      text: `${stopped ? "Interrompu — " : ""}${done} description(s) actualisée(s)` + (notFound.length ? ` · ${notFound.length} sans page Wikipédia` : ""),
    });
  };
  const cancelRefresh = () => { refreshCancelRef.current = true; };

  // Fetch covers + metacritic manquants au démarrage
  useEffect(() => {
    const fetchCovers = async () => {
      if (!API_KEYS.rawg) return;   // pas de clé RAWG configurée -> on ne tente rien
      const missing = games.filter(g => !g.cover);
      for (const g of missing) {
        try {
          const r = await fetch(`https://api.rawg.io/api/games?key=${API_KEYS.rawg}&search=${encodeURIComponent(g.title)}&page_size=1`);
          const d = await r.json();
          const result = d.results?.[0];
          if (result) {
            setGames(gs => gs.map(x => x.id === g.id ? {
              ...x,
              cover: result.background_image || x.cover,
              metacritic: result.metacritic || x.metacritic,
            } : x));
          }
          await new Promise(res => setTimeout(res, 120)); // ~8 req/s, sous la limite RAWG
        } catch {}
      }
    };
    fetchCovers();
  }, []); // eslint-disable-line

  const edit = (id, field, val) => setGames(gs => gs.map(g => g.id === id ? { ...g, [field]: val } : g));
  const enrichGame = (id, data) => setGames(gs => gs.map(g => g.id === id ? { ...g, ...data } : g));
  const startTimer = (id) => { setActiveTimer(id); setTimerStart(Date.now()); };
  const stopTimer = (id) => {
    const mins = Math.round((Date.now() - timerStart) / 60000);
    if (mins > 0) setGames(gs => gs.map(g => g.id === id ? { ...g, playedMinutes: g.playedMinutes + mins, sessions: [...(g.sessions || []), { date: new Date().toISOString(), minutes: mins }] } : g));
    setActiveTimer(null); setTimerStart(null);
  };
  // Ajoute le jeu puis l'ouvre directement en fiche complète (parité fiche/ajout).
  const addGame = (g) => {
    setGames(gs => [g, ...gs]);
    setShowAdd(false);
    setLastAddedId(g.id);
    setTab("library");
    setView("liste");
    setPlat("tous");
    setStatFil("tous");
    setSearch("");
  };

  // Import Xbox : ajoute les jeux créés, ferme le modal, propose l'enrichissement (E).
  const importGames = (created) => {
    setShowImport(false);
    if (!created.length) return;
    setGames(gs => [...created, ...gs]);
    setImportedIds(created.map(g => g.id));
    setTab("library");
    setView("liste");
    setPlat("tous");
    setStatFil("tous");
    setSearch("");
  };

  // Enrichissement best-effort des jeux importés : RAWG (cover/metacritic/genre si manquants)
  // + description Wikipédia. Annulable, avec délai anti-rate-limit.
  const enrichImported = async () => {
    if (enriching || !importedIds.length) return;
    enrichCancelRef.current = false;
    setEnriching(true);
    setEnrichProg(0);
    const ids = [...importedIds];
    for (let i = 0; i < ids.length; i++) {
      if (enrichCancelRef.current) break;
      const g = games.find(x => x.id === ids[i]) || null;
      const title = g?.title;
      if (title) {
        try {
          const res = await rawgSearch(title);
          if (res[0]) {
            const d = await rawgDetail(res[0].id);
            if (d) setGames(gs => gs.map(x => x.id === ids[i] ? { ...x, cover: x.cover || d.background_image || null, metacritic: x.metacritic ?? d.metacritic ?? null, genre: x.genre?.length ? x.genre : (d.genres?.map(z => z.name) || []) } : x));
          }
          const titles = await wikiFrenchTitles(title);
          const best = pickBestWikiTitle(title, titles);
          if (best) { const { extract } = await wikiArticleData(best.title); if (extract) setGames(gs => gs.map(x => x.id === ids[i] ? { ...x, style: x.style || extract } : x)); }
        } catch {}
      }
      setEnrichProg(i + 1);
      await new Promise(r => setTimeout(r, 200));
    }
    setEnriching(false);
    setImportedIds([]);
  };
  const cancelEnrich = () => { enrichCancelRef.current = true; };
  const deleteGame = (g) => {
    const index = games.findIndex(x => x.id === g.id);
    setGames(gs => gs.filter(x => x.id !== g.id));
    setDeleted({ game: g, index });
    clearTimeout(undoRef.current);
    undoRef.current = setTimeout(() => setDeleted(null), 5000);
  };
  const undoDelete = () => {
    if (!deleted) return;
    clearTimeout(undoRef.current);
    setGames(gs => { const c = [...gs]; c.splice(Math.min(deleted.index, c.length), 0, deleted.game); return c; });
    setDeleted(null);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(games, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `game-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };
  const importJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error("format");
        const replace = window.confirm(`Fichier : ${data.length} jeux.\n\nOK = REMPLACER toute la bibliothèque\nAnnuler = FUSIONNER (ajoute uniquement les jeux absents)`);
        if (replace) setGames(data);
        else setGames(gs => { const ids = new Set(gs.map(x => x.id)); return [...gs, ...data.filter(x => !ids.has(x.id))]; });
      } catch { alert("Fichier JSON invalide."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const filtered = useMemo(() => {
    // Recherche insensible à la casse et aux accents (S1), sur titre + genre + tag
    // uniquement : la description (style) est exclue pour éviter les faux positifs.
    const q = normTitle(search);
    let list = games.filter(g => {
      const searchMatch = !q
        || normTitle(g.title).includes(q)
        || g.genre.some(x => normTitle(x).includes(q))
        || normTitle(g.tag).includes(q);
      // Une plateforme récente affiche ses jeux natifs + ceux de la plateforme
      // précédente marqués backCompat (voir BACK_COMPAT) : "Xbox Series X" inclut les
      // Xbox One rétrocompatibles, "Switch 2" les Switch 1. Les plateformes
      // "anciennes" ("Xbox One", "Switch 1") restent strictes.
      const platMatch = plat === "tous" || g.platform === plat
        || (BACK_COMPAT[plat] === g.platform && !!g.backCompat);
      const statusMatch = statFil === "tous" ? true
        : statFil === "à finir" ? (g.status === "en cours" || g.status === "non commencé")
        : g.status === statFil;
      return searchMatch
        && platMatch
        && (fmtFil === "tous" || g.format === fmtFil)
        && statusMatch;
    });
    return list.sort((a, b) => {
      if (statFil === "à finir") return staleKey(a) - staleKey(b); // plus anciennes d'abord
      if (sort === "date") return new Date(b.addedDate) - new Date(a.addedDate);
      if (sort === "metacritic") return (b.metacritic||0) - (a.metacritic||0);
      if (sort === "temps") return (b.playedMinutes+b.manualMinutes) - (a.playedMinutes+a.manualMinutes);
      return a.title.localeCompare(b.title);
    });
  }, [games, search, plat, statFil, fmtFil, sort]);

  const stats = useMemo(() => {
    const total = games.length, termines = games.filter(g => g.status === "terminé").length;
    const enCours = games.filter(g => g.status === "en cours").length, pretes = games.filter(g => g.lentA).length;
    const totalTime = games.reduce((a, g) => a + g.playedMinutes + g.manualMinutes, 0);
    const byGenre = {}; games.forEach(g => g.genre.forEach(x => byGenre[x] = (byGenre[x]||0) + 1));
    const topGenres = Object.entries(byGenre).sort((a,b) => b[1]-a[1]).slice(0,6);
    return { total, termines, enCours, pretes, totalTime, topGenres };
  }, [games]);

  const lentGames = games.filter(g => g.lentA);

  const emptyState = (
    <div style={{ textAlign: "center", padding: "70px 20px", color: mut }}>
      <div style={{ fontSize: 56, marginBottom: 12, opacity: 0.85 }}>🎮</div>
      <div style={{ color: txt, fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Aucun jeu trouvé</div>
      <div style={{ fontSize: 12 }}>Essaie un autre terme ou change les filtres 🔍</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ background: hdr, borderBottom: `1px solid ${bdr}`, padding: "calc(12px + var(--safe-top)) calc(14px + var(--safe-right)) 12px calc(14px + var(--safe-left))", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: "#5493FF", lineHeight: 1.4 }}>GAME LIBRARY</div>
            <div style={{ fontSize: 10, color: mut, marginTop: 2 }}>{stats.total} jeux · {stats.termines} terminés · {stats.enCours} en cours</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button onClick={refreshAllDescriptions} disabled={refreshing} title="Actualiser toutes les descriptions depuis Wikipédia FR" style={{ background: "transparent", border: `1px solid ${bdr}`, color: refreshing ? "#5493FF" : mut, borderRadius: 6, padding: "5px 8px", fontSize: 11, cursor: refreshing ? "default" : "pointer", opacity: refreshing ? 0.8 : 1, whiteSpace: "nowrap" }}>
              {refreshing ? `⏳ ${refreshProg}/${games.length} actualisés` : "🌐 Actualiser descriptions"}
            </button>
            {refreshing && <button onClick={cancelRefresh} title="Annuler l'actualisation" style={{ background: "#ef444422", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 6, padding: "5px 8px", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>Annuler</button>}
            <button onClick={() => setShowImport(true)} title="Importer la bibliothèque Xbox (xbl.io)" style={{ background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: 6, padding: "5px 8px", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>🎮 Importer Xbox</button>
            <button onClick={() => setTheme(t => (t === "dark" ? "light" : "dark"))} style={{ background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: 6, padding: "5px 8px", fontSize: 12, cursor: "pointer" }}>{theme === "dark" ? "☀️" : "🌙"}</button>
            <button onClick={() => setShowAdd(true)} style={{ background: "#5493FF", color: "#fff", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Ajouter</button>
          </div>
        </div>

        {refreshMsg && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: card, border: `1px solid ${bdr}`, borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: txt, fontSize: 11, fontWeight: 600 }}>{refreshMsg.text}</div>
              {refreshMsg.notFound.length > 0 && <div style={{ color: mut, fontSize: 10, marginTop: 3, maxHeight: 54, overflowY: "auto" }}>Sans page : {refreshMsg.notFound.join(", ")}</div>}
            </div>
            <button onClick={() => setRefreshMsg(null)} style={{ background: "transparent", border: "none", color: mut, fontSize: 14, cursor: "pointer", lineHeight: 1, padding: 0 }}>✕</button>
          </div>
        )}

        {(importedIds.length > 0 || enriching) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: card, border: `1px solid ${bdr}`, borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0, color: txt, fontSize: 11, fontWeight: 600 }}>
              {enriching ? `Enrichissement… ${enrichProg}/${importedIds.length}` : `${importedIds.length} jeu(x) importé(s) — enrichir via RAWG + Wikipédia ?`}
            </div>
            {enriching
              ? <button onClick={cancelEnrich} style={{ background: "#ef444422", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>Arrêter</button>
              : <>
                  <button onClick={enrichImported} style={{ background: "#5493FF22", border: "1px solid #5493FF", color: "#5493FF", borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>Enrichir</button>
                  <button onClick={() => setImportedIds([])} style={{ background: "transparent", border: "none", color: mut, fontSize: 14, cursor: "pointer", lineHeight: 1, padding: 0 }}>✕</button>
                </>}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {[["library","Bibliothèque"],["loans",`Prêts${lentGames.length ? ` (${lentGames.length})` : ""}`],["stats","Stats"],["settings","⚙️"]].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ background: tab===k?"#5493FF":"transparent", border:`1px solid ${tab===k?"#5493FF":bdr}`, color: tab===k?"#fff":mut, borderRadius:6, padding:"4px 10px", fontSize:11, cursor:"pointer" }}>{l}</button>
          ))}
        </div>

        {tab === "library" && <>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher titre, genre, tag…" style={{ background: card, border:`1px solid ${bdr}`, borderRadius:8, color:txt, padding:"7px 12px", fontSize:13, outline:"none", width:"100%", marginBottom:8 }} />
          <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:6 }}>
            {PLATFORMS.map(p => <button key={p} onClick={() => setPlat(p)} style={{ background:plat===p?"#5493FF22":"transparent", border:`1px solid ${plat===p?"#5493FF":bdr}`, color:plat===p?"#5493FF":mut, borderRadius:5, padding:"3px 8px", fontSize:10, cursor:"pointer" }}>{p==="tous"?"Toutes":p}</button>)}
          </div>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:6 }}>
            {["tous",...STATUTS,"à finir"].map(s => <button key={s} onClick={() => setStatFil(s)} style={{ background:statFil===s?(STATUS_COLORS[s]||"#5493FF")+"22":"transparent", border:`1px solid ${statFil===s?(STATUS_COLORS[s]||"#5493FF"):bdr}`, color:statFil===s?(STATUS_COLORS[s]||"#5493FF"):mut, borderRadius:5, padding:"3px 7px", fontSize:10, cursor:"pointer" }}>{s==="tous"?"Tous":s==="à finir"?"🎯 à finir":s}</button>)}
          </div>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:6 }}>
            {[["tous","Tous"],["physique","Physique"],["démat","Démat"]].map(([k,l]) => <button key={k} onClick={() => setFmtFil(k)} style={{ background:fmtFil===k?"#5493FF22":"transparent", border:`1px solid ${fmtFil===k?"#5493FF":bdr}`, color:fmtFil===k?"#5493FF":mut, borderRadius:5, padding:"3px 8px", fontSize:10, cursor:"pointer" }}>{l}</button>)}
          </div>
          <div style={{ display:"flex", gap:4, alignItems:"center", flexWrap:"wrap" }}>
            <span style={{ color:mut, fontSize:10 }}>Tri:</span>
            {[["titre","A-Z"],["date","Date"],["metacritic","MC"],["temps","Temps"]].map(([k,l]) => <button key={k} onClick={() => setSort(k)} style={{ background:sort===k?"#5493FF22":"transparent", border:`1px solid ${sort===k?"#5493FF":bdr}`, color:sort===k?"#5493FF":mut, borderRadius:5, padding:"3px 7px", fontSize:10, cursor:"pointer" }}>{l}</button>)}
            <div style={{ marginLeft:"auto", display:"flex", gap:4 }}>
              {[["liste","☰"],["grille","⊞"]].map(([m,ic]) => <button key={m} onClick={() => setView(m)} style={{ background:view===m?"#5493FF22":"transparent", border:`1px solid ${view===m?"#5493FF":bdr}`, color:view===m?"#5493FF":mut, borderRadius:5, padding:"3px 8px", fontSize:13, cursor:"pointer" }}>{ic}</button>)}
            </div>
          </div>
        </>}
      </div>

      {/* Body */}
      <div style={{ padding:"14px calc(14px + var(--safe-right)) calc(60px + var(--safe-bottom)) calc(14px + var(--safe-left))" }}>
        {tab === "library" && (filtered.length === 0 ? emptyState : view === "grille" ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-bg,minmax(120px,1fr))", gap:10 }}>
            {filtered.map(g => (
              <div key={g.id} className="gl-tile" style={{ background:card, border:`1px solid ${bdr}`, borderRadius:10, overflow:"hidden", cursor:"pointer" }}
                onClick={() => { setView("liste"); setSearch(g.title); setTimeout(()=>setSearch(""),2000); }}>
                <Cover src={g.cover} title={g.title} size="100%" />
                <div style={{ height:3, background:STATUS_COLORS[g.status]+"88" }} />
                <div style={{ padding:"6px 7px" }}>
                  <div style={{ color:txt, fontSize:10, fontWeight:600, lineHeight:1.3, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{g.title}</div>
                  {g.metacritic && <div style={{ color:g.metacritic>=80?"#22c55e":"#f59e0b", fontSize:9, marginTop:2 }}>MC {g.metacritic}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {filtered.map(g => <GameCard key={g.id} g={g} onEdit={edit} onDelete={deleteGame} onEnrich={enrichGame} activeTimer={activeTimer} onStartTimer={startTimer} onStopTimer={stopTimer} autoOpen={g.id === lastAddedId} />)}
          </div>
        ))}

        {tab === "loans" && (
          <div>
            {lentGames.length === 0 ? <div style={{ textAlign:"center", color:mut, padding:"60px 0" }}>Aucun jeu prêté actuellement</div>
            : lentGames.map(g => {
              const days = g.lentDate ? Math.floor((Date.now()-new Date(g.lentDate))/86400000) : null;
              return (
                <div key={g.id} style={{ background:card, border:`1px solid ${days>30?"#ef4444":bdr}`, borderRadius:10, padding:"12px", marginBottom:8, display:"flex", gap:10, alignItems:"center" }}>
                  <Cover src={g.cover} title={g.title} size={52} />
                  <div style={{ flex:1 }}>
                    <div style={{ color:txt, fontWeight:600, fontSize:13 }}>{g.title}</div>
                    <div style={{ color:"#f59e0b", fontSize:12 }}>📤 {g.lentA}</div>
                    {days!==null && <div style={{ color:days>30?"#ef4444":mut, fontSize:11 }}>{days}j{days>30?" ⚠️ Prêt long !":""}</div>}
                  </div>
                  <a href={`sms:?body=${encodeURIComponent(`Salut ! Tu penses à me rendre ${g.title} ? 😊`)}`} style={{ background:"#f59e0b22", border:"1px solid #f59e0b", color:"#f59e0b", borderRadius:6, padding:"5px 10px", fontSize:11, textDecoration:"none" }}>SMS</a>
                </div>
              );
            })}
          </div>
        )}

        {tab === "settings" && (() => {
          const champs = [
            ["rawg", "Clé RAWG", "Jaquettes, Metacritic, genres, dates de sortie", "https://rawg.io/apidocs"],
            ["sgdb", "Clé SteamGridDB", "Jaquettes verticales format boîte", "https://www.steamgriddb.com/profile/preferences/api"],
            ["xbl", "Clé xbl.io", "Import de la bibliothèque Xbox", "https://xbl.io/console"],
          ];
          const testKey = async (id) => {
            setKeyTest(t => ({ ...t, [id]: "…" }));
            let ok = false;
            try {
              if (id === "rawg") ok = (await rawgSearch("halo")).length > 0;
              if (id === "sgdb") ok = (await sgdbSearch("halo")).length > 0;
              if (id === "xbl") ok = (await xblTitleHistory()).length > 0;
            } catch {}
            setKeyTest(t => ({ ...t, [id]: ok ? "ok" : "ko" }));
          };
          const champStyle = { width: "100%", boxSizing: "border-box", background: card, border: `1px solid ${bdr}`, borderRadius: 6, color: txt, padding: "7px 9px", fontSize: 12, outline: "none", fontFamily: "monospace" };
          return (
            <div>
              <div style={{ background: card, border:`1px solid ${bdr}`, borderRadius:10, padding:14, marginBottom:12 }}>
                <div style={{ color:txt, fontWeight:600, fontSize:13, marginBottom:4 }}>Clés API</div>
                <div style={{ color:mut, fontSize:11, marginBottom:12 }}>
                  Elles restent <strong>sur cet appareil</strong> (stockage local du navigateur) et ne sont jamais envoyées ailleurs qu'aux services concernés.
                  Elles ne figurent ni dans le code, ni dans l'export.
                </div>
                {champs.map(([id, label, desc, lien]) => (
                  <div key={id} style={{ marginBottom: 12 }}>
                    <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:3, flexWrap:"wrap" }}>
                      <span style={{ color:txt, fontSize:12, fontWeight:600 }}>{label}</span>
                      <a href={lien} target="_blank" rel="noreferrer" style={{ color:"#5493FF", fontSize:10, textDecoration:"none" }}>↗ obtenir</a>
                      <span style={{ color:mut, fontSize:10 }}>— {desc}</span>
                    </div>
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <input type={showKeys ? "text" : "password"} value={keys[id]} placeholder="non configurée"
                        onChange={e => setKeys(k => ({ ...k, [id]: e.target.value.trim() }))} style={champStyle} />
                      <button onClick={() => testKey(id)} disabled={!keys[id]}
                        style={{ background:"transparent", border:`1px solid ${bdr}`, color:mut, borderRadius:5, padding:"5px 9px", fontSize:10, cursor: keys[id] ? "pointer":"default", opacity: keys[id]?1:0.5, whiteSpace:"nowrap" }}>Tester</button>
                      <span style={{ fontSize:14, width:16, textAlign:"center" }}>
                        {keyTest[id] === "ok" ? "✅" : keyTest[id] === "ko" ? "❌" : keyTest[id] === "…" ? "⏳" : ""}
                      </span>
                    </div>
                  </div>
                ))}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ color:txt, fontSize:12, fontWeight:600, marginBottom:3 }}>Relais CORS (Cloudflare Worker)</div>
                  <div style={{ color:mut, fontSize:10, marginBottom:3 }}>
                    Requis en ligne pour SteamGridDB et xbl.io, qui refusent les appels directs du navigateur. Laisser vide en développement local.
                  </div>
                  <input type="text" value={keys.proxy} placeholder="https://mon-worker.workers.dev"
                    onChange={e => setKeys(k => ({ ...k, proxy: e.target.value.trim() }))} style={champStyle} />
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                  <button onClick={() => { setApiKeys(keys); setKeyTest({}); setSavedMsg(true); setTimeout(() => setSavedMsg(false), 2000); }}
                    style={{ background:"#5493FF", border:"none", color:"#fff", borderRadius:8, padding:"8px 14px", fontSize:12, fontWeight:600, cursor:"pointer" }}>Enregistrer</button>
                  <button onClick={() => setShowKeys(v => !v)}
                    style={{ background:"transparent", border:`1px solid ${bdr}`, color:mut, borderRadius:8, padding:"8px 12px", fontSize:12, cursor:"pointer" }}>{showKeys ? "Masquer" : "Afficher"}</button>
                  {savedMsg && <span style={{ color:"#22c55e", fontSize:11 }}>Enregistré ✓</span>}
                </div>
              </div>
              <div style={{ background: card, border:`1px solid ${bdr}`, borderRadius:10, padding:14, color:mut, fontSize:11, lineHeight:1.5 }}>
                ⚠️ L'<strong>Export JSON</strong> (onglet Stats) contient tes jeux mais <strong>pas tes clés</strong> — c'est volontaire, pour pouvoir partager ou sauvegarder un export sans fuite.
                Sur un nouvel appareil, il faut donc importer l'export <em>et</em> resaisir les clés ici.
              </div>
            </div>
          );
        })()}

        {tab === "stats" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
              {[["Total",stats.total,"#5493FF"],["Terminés",`${stats.termines} (${Math.round(stats.termines/stats.total*100)}%)`,"#22c55e"],["En cours",stats.enCours,"#5493FF"],["Prêtés",stats.pretes,"#f59e0b"],["Temps total",fmtTime(stats.totalTime),"#a855f7"]].map(([l,v,c]) => (
                <div key={l} style={{ background:card, border:`1px solid ${bdr}`, borderRadius:10, padding:"12px 14px" }}>
                  <div style={{ color:mut, fontSize:10 }}>{l}</div>
                  <div style={{ color:c, fontSize:20, fontWeight:700, marginTop:2 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ background:card, border:`1px solid ${bdr}`, borderRadius:10, padding:14, marginBottom:16 }}>
              <div style={{ color:txt, fontWeight:600, fontSize:13, marginBottom:10 }}>Top genres</div>
              {stats.topGenres.map(([genre,count]) => (
                <div key={genre} style={{ marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}><span style={{ color:txt, fontSize:12 }}>{genre}</span><span style={{ color:mut, fontSize:11 }}>{count}</span></div>
                  <div style={{ height:4, background:bdr, borderRadius:2 }}><div style={{ width:`${count/stats.total*100}%`, height:"100%", background:"#5493FF", borderRadius:2 }} /></div>
                </div>
              ))}
            </div>
            <div style={{ background:card, border:`1px solid ${bdr}`, borderRadius:10, padding:14 }}>
              <div style={{ color:txt, fontWeight:600, fontSize:13, marginBottom:4 }}>Sauvegarde</div>
              <div style={{ color:mut, fontSize:11, marginBottom:10 }}>Exporte ou restaure toute la bibliothèque au format JSON.</div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={exportJSON} style={{ flex:1, background:"#5493FF22", border:"1px solid #5493FF", color:"#5493FF", borderRadius:8, padding:"8px 12px", fontSize:12, fontWeight:600, cursor:"pointer" }}>⬇ Exporter</button>
                <button onClick={() => importRef.current?.click()} style={{ flex:1, background:"transparent", border:`1px solid ${bdr}`, color:txt, borderRadius:8, padding:"8px 12px", fontSize:12, fontWeight:600, cursor:"pointer" }}>⬆ Importer</button>
                <input ref={importRef} type="file" accept="application/json,.json" onChange={importJSON} style={{ display:"none" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {showAdd && <AddModal onAdd={addGame} onClose={() => setShowAdd(false)} />}
      {showImport && <ImportModal games={games} onImportGames={importGames} onClose={() => setShowImport(false)} />}

      {deleted && (
        <div style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)", zIndex:400, display:"flex", alignItems:"center", gap:14, background:card, border:`1px solid ${bdr}`, borderRadius:10, padding:"10px 14px", boxShadow:"0 8px 24px rgba(0,0,0,0.4)", animation:"toastIn 200ms ease" }}>
          <span style={{ color:txt, fontSize:13 }}>🗑 « {deleted.game.title} » supprimé</span>
          <button onClick={undoDelete} style={{ background:"transparent", border:"1px solid #5493FF", color:"#5493FF", borderRadius:6, padding:"4px 12px", fontSize:12, fontWeight:600, cursor:"pointer" }}>Annuler</button>
        </div>
      )}
    </div>
  );
}

