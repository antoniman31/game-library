import { useState, useMemo, useEffect, useRef } from "react";

const RAWG_KEY = "CLE_RAWG_RETIREE_DE_L_HISTORIQUE";

async function rawgSearch(q) {
  if (!q || q.trim().length < 2) return [];
  try {
    const r = await fetch(`https://api.rawg.io/api/games?key=${RAWG_KEY}&search=${encodeURIComponent(q)}&page_size=10`);
    const d = await r.json();
    return d.results || [];
  } catch { return []; }
}

async function rawgDetail(id) {
  try {
    const r = await fetch(`https://api.rawg.io/api/games/${id}?key=${RAWG_KEY}`);
    return await r.json();
  } catch { return null; }
}

// Découpe un texte en segments de ≤500 caractères en coupant sur des fins de phrase
// (". ") pour ne jamais couper au milieu d'un mot.
function splitIntoSegments(text, max = 500) {
  if (text.length <= max) return [text];
  const segments = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(". ", max - 1);
    if (cut <= 0) cut = rest.lastIndexOf(" ", max - 1); // pas de fin de phrase : coupe sur un espace
    if (cut <= 0) cut = max; // aucun espace : coupe dur
    else cut += 1; // inclut le "." ou l'espace dans le segment courant
    segments.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) segments.push(rest);
  return segments;
}

async function mymemoryTranslate(text) {
  const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|fr`);
  if (!r.ok) throw new Error("mymemory http " + r.status);
  const d = await r.json();
  const out = d?.responseData?.translatedText?.trim();
  if (!out) throw new Error("mymemory empty");
  return out;
}

// Traduit en français une description RAWG (anglais) via l'API gratuite MyMemory.
// Les textes >500 caractères sont découpés en segments traduits séquentiellement
// (délai 150ms entre appels) puis recollés.
// Fallback : description anglaise brute non tronquée si un des appels échoue.
async function frenchDescription(descRaw) {
  const clean = (descRaw || "").replace(/<[^>]+>/g, "").trim();
  if (!clean) return "";
  const segments = splitIntoSegments(clean, 500);
  try {
    const translated = [];
    for (let i = 0; i < segments.length; i++) {
      translated.push(await mymemoryTranslate(segments[i]));
      if (i < segments.length - 1) await new Promise(res => setTimeout(res, 150));
    }
    return translated.join(" ");
  } catch { return clean; }
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
const PLATFORMS = ["tous", "Xbox", "Switch 2", "Switch 1"];

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

function Cover({ src, title, size = 72 }) {
  const [err, setErr] = useState(false);
  const bg = ["#1a2a4a","#2a1a4a","#1a4a2a","#4a2a1a","#2a4a4a"][title.charCodeAt(0) % 5];
  if (!src || err) return (
    <div style={{ width: size, height: size, minWidth: size, background: bg, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.3 }}>🎮</div>
  );
  return <img src={src} alt={title} onError={() => setErr(true)} style={{ width: size, height: size, minWidth: size, objectFit: "cover", borderRadius: 8 }} />;
}

function GameCard({ g, onEdit, onDelete, onEnrich, activeTimer, onStartTimer, onStopTimer, dark }) {
  const [open, setOpen] = useState(false);
  const [loanName, setLoanName] = useState(g.lentA || "");
  const [rawgOpen, setRawgOpen] = useState(false);
  const [rawgQ, setRawgQ] = useState(g.title);
  const [rawgSugg, setRawgSugg] = useState([]);
  const [rawgBusy, setRawgBusy] = useState(false);
  const rawgDebRef = useRef(null);
  const [descOpen, setDescOpen] = useState(false);
  const [manH, setManH] = useState(0);
  const [manM, setManM] = useState(0);
  const [tick, setTick] = useState(0);
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
  const card = dark ? "#1a1a2e" : "#f0f4ff";
  const bdr = dark ? "#2a2a4a" : "#d0d8f0";
  const txt = dark ? "#e2e8f0" : "#1e2a4a";
  const mut = dark ? "#64748b" : "#8090b0";
  const fill = dark ? "#0f0f1a" : "#e8eef8";
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
      const style = await frenchDescription(d.description_raw);
      onEnrich(g.id, {
        cover: d.background_image || g.cover,
        metacritic: d.metacritic ?? g.metacritic,
        genre: d.genres?.map(x => x.name) || g.genre,
        style: style || g.style,
      });
    }
    setRawgBusy(false);
    setRawgOpen(false);
  };

  const acc = (id, title, content) => (
    <div style={{ marginBottom: 8 }}>
      <button onClick={() => toggle(id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", boxSizing: "border-box", background: fill, border: `1px solid ${bdr}`, borderRadius: section === id ? "8px 8px 0 0" : 8, padding: "8px 12px", color: txt, fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
        <span>{title}</span>
        <span style={{ color: mut }}>{section === id ? "▾" : "▸"}</span>
      </button>
      {section === id && <div style={{ background: fill, border: `1px solid ${bdr}`, borderTop: "none", borderRadius: "0 0 8px 8px", padding: "10px 12px" }}>{content}</div>}
    </div>
  );

  return (
    <div style={{ background: card, border: `1px ${dusty ? "dashed" : "solid"} ${baseBorder}`, borderRadius: 12, overflow: "hidden", opacity: dusty ? 0.72 : 1, transition: "border-color 0.2s, opacity 0.2s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#5493FF"; e.currentTarget.style.opacity = 1; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = baseBorder; e.currentTarget.style.opacity = dusty ? 0.72 : 1; }}>

      <div style={{ display: "flex", gap: 10, padding: 12, cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <Cover src={g.cover} title={g.title} size={72} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ background: g.platform === "Xbox" ? "#107C10" : "#e4000f", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 3, padding: "1px 5px" }}>{g.platform}</span>
            <span key={g.status} style={{ border: `1px solid ${STATUS_COLORS[g.status]}`, color: STATUS_COLORS[g.status], fontSize: 9, borderRadius: 3, padding: "1px 5px", display: "inline-block", animation: "statusPop 200ms ease" }}>{g.status}</span>
            {g.format === "démat" && <span style={{ background: dark ? "#1e3a5f" : "#ddeeff", color: "#5493FF", fontSize: 9, borderRadius: 3, padding: "1px 5px" }}>démat</span>}
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
          {hltbPct !== null && <div style={{ marginTop: 4, height: 3, background: dark ? "#2a2a4a" : "#d0d8f0", borderRadius: 2 }}><div style={{ width: `${Math.min(100, hltbPct)}%`, height: "100%", background: hltbPct >= 100 ? "#22c55e" : "#5493FF", borderRadius: 2 }} /></div>}
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
            {g.genre.map(x => <span key={x} style={{ background: dark ? "#0f0f1a" : "#e8eef8", color: mut, fontSize: 10, borderRadius: 4, padding: "2px 7px", border: `1px solid ${bdr}` }}>{x}</span>)}
          </div>

          {/* Statut */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
            {STATUTS.map(s => <button key={s} onClick={() => onEdit(g.id, "status", s)} style={{ background: g.status === s ? STATUS_COLORS[s] + "33" : "transparent", border: `1px solid ${g.status === s ? STATUS_COLORS[s] : bdr}`, color: g.status === s ? STATUS_COLORS[s] : mut, borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>{s}</button>)}
          </div>

          {/* Chrono */}
          <div style={{ background: dark ? "#0f0f1a" : "#e8eef8", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
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
            <div style={{ position: "relative", background: fill, border: `1px solid ${bdr}`, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
              <div style={{ color: txt, fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Ré-associer depuis RAWG</div>
              <input value={rawgQ} onChange={e => rawgQuery(e.target.value)} placeholder="Titre du jeu…" autoFocus style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: `1px solid ${bdr}`, borderRadius: 6, color: txt, padding: "6px 8px", fontSize: 12, outline: "none" }} />
              {rawgBusy && <div style={{ color: "#5493FF", fontSize: 11, marginTop: 4 }}>Récupération & traduction…</div>}
              {rawgSugg.length > 0 && !rawgBusy && (
                <div style={{ marginTop: 6, background: card, border: `1px solid ${bdr}`, borderRadius: 8, maxHeight: 300, overflowY: "auto", boxShadow: "0 8px 24px #0008" }}>
                  {rawgSugg.map(s => (
                    <div key={s.id} onClick={() => rawgPick(s)} style={{ display: "flex", gap: 8, padding: "7px 9px", cursor: "pointer", borderBottom: `1px solid ${bdr}`, alignItems: "center" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#5493FF22"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      {s.background_image && <img src={s.background_image} style={{ width: 34, height: 34, minWidth: 34, objectFit: "cover", borderRadius: 4 }} />}
                      <div style={{ minWidth: 0 }}><div style={{ color: txt, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div><div style={{ color: mut, fontSize: 10 }}>{s.released}{s.metacritic ? ` · MC ${s.metacritic}` : ""}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ color: mut, fontSize: 10 }}>Ajouté le {new Date(g.addedDate).toLocaleDateString("fr-FR")}</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => { setRawgOpen(o => !o); if (!rawgOpen) { setRawgQ(g.title); rawgQuery(g.title); } }} style={{ background: "transparent", border: "1px solid #5493FF", color: "#5493FF", borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>🔄 Rechercher sur RAWG</button>
              <button onClick={() => onDelete(g)} style={{ background: "transparent", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddModal({ dark, onAdd, onClose }) {
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("Xbox");
  const [fmt, setFmt] = useState("physique");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("non commencé");
  const [loading, setLoading] = useState(false);
  const [sugg, setSugg] = useState([]);
  const [rawg, setRawg] = useState(null);
  const [styleFr, setStyleFr] = useState("");
  const debRef = useRef(null);

  const bg = dark ? "#1a1a2e" : "#f0f4ff";
  const bdr = dark ? "#2a2a4a" : "#d0d8f0";
  const txt = dark ? "#e2e8f0" : "#1e2a4a";
  const inp = { background: dark ? "#0f0f1a" : "#e8eef8", border: `1px solid ${bdr}`, borderRadius: 8, color: txt, padding: "8px 12px", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };

  const search = async (q) => setSugg(await rawgSearch(q));

  const pick = async (game) => {
    setTitle(game.name);
    setSugg([]);
    setLoading(true);
    const d = await rawgDetail(game.id);
    if (d) {
      setRawg(d);
      if (d.released) setDate(d.released);
      setStyleFr(await frenchDescription(d.description_raw));
    }
    setLoading(false);
  };

  const handleAdd = () => {
    if (!title.trim()) return;
    onAdd({
      id: Date.now(), title: title.trim(), platform, format: fmt,
      addedDate: date || new Date().toISOString().slice(0, 10),
      genre: rawg?.genres?.map(g => g.name) || [],
      style: styleFr || rawg?.description_raw?.replace(/<[^>]+>/g, "") || "",
      status, note: null, lentA: null, lentDate: null,
      cover: rawg?.background_image || null,
      metacritic: rawg?.metacritic || null,
      hltb: null, playedMinutes: 0, manualMinutes: 0, sessions: [],
      myLinks: ["","",""], tips: "", tag: "", progression: ""
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000b", zIndex: 300, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: "16px 16px 0 0", padding: 20, width: "100%", maxWidth: 500, margin: "0 auto", maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 15, color: txt, marginBottom: 14 }}>Ajouter un jeu</div>

        <div style={{ position: "relative", marginBottom: 10 }}>
          <input value={title} onChange={e => { setTitle(e.target.value); clearTimeout(debRef.current); debRef.current = setTimeout(() => search(e.target.value), 350); }} placeholder="Titre du jeu *" style={inp} />
          {loading && <div style={{ color: "#5493FF", fontSize: 11, marginTop: 3 }}>Recherche RAWG…</div>}
          {sugg.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: bg, border: `1px solid ${bdr}`, borderRadius: 8, zIndex: 10, overflow: "hidden", boxShadow: "0 8px 24px #0008" }}>
              {sugg.map(s => (
                <div key={s.id} onClick={() => pick(s)} style={{ display: "flex", gap: 8, padding: "8px 10px", cursor: "pointer", borderBottom: `1px solid ${bdr}` }}
                  onMouseEnter={e => e.currentTarget.style.background = "#5493FF22"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  {s.background_image && <img src={s.background_image} style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4 }} />}
                  <div><div style={{ color: txt, fontSize: 12, fontWeight: 600 }}>{s.name}</div><div style={{ color: "#64748b", fontSize: 10 }}>{s.released}{s.metacritic ? ` · MC ${s.metacritic}` : ""}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {rawg && (
          <div style={{ background: dark ? "#0f0f1a" : "#e8eef8", borderRadius: 8, padding: "8px 10px", marginBottom: 10, display: "flex", gap: 10, alignItems: "center" }}>
            {rawg.background_image && <img src={rawg.background_image} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }} />}
            <div><div style={{ color: txt, fontSize: 12, fontWeight: 600 }}>{rawg.name}</div><div style={{ color: "#64748b", fontSize: 10 }}>{rawg.genres?.map(g => g.name).join(", ")} {rawg.metacritic ? `· MC ${rawg.metacritic}` : ""}</div></div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <select value={platform} onChange={e => setPlatform(e.target.value)} style={{ ...inp, flex: 1 }}><option>Xbox</option><option>Switch 2</option><option>Switch 1</option></select>
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

export default function App() {
  const [games, setGames] = useState(() => { try { const s = localStorage.getItem("gl_v2"); return s ? JSON.parse(s) : GAMES_INIT; } catch { return GAMES_INIT; } });
  const [search, setSearch] = useState("");
  const [plat, setPlat] = useState("tous");
  const [statFil, setStatFil] = useState("tous");
  const [sort, setSort] = useState("titre");
  const [view, setView] = useState("liste");
  const [tab, setTab] = useState("library");
  const [showAdd, setShowAdd] = useState(false);
  const [activeTimer, setActiveTimer] = useState(null);
  const [timerStart, setTimerStart] = useState(null);
  const [dark, setDark] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProg, setRefreshProg] = useState(0);
  const [deleted, setDeleted] = useState(null); // { game, index } pour l'undo
  const undoRef = useRef(null);
  const importRef = useRef(null);

  useEffect(() => { try { localStorage.setItem("gl_v2", JSON.stringify(games)); } catch {} }, [games]);

  // Force la (re)traduction FR de toutes les descriptions : récupère la description
  // anglaise RAWG de chaque jeu puis la traduit via frenchDescription (découpage inclus).
  const refreshAllDescriptions = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshProg(0);
    const list = [...games];
    for (let i = 0; i < list.length; i++) {
      const g = list[i];
      try {
        const results = await rawgSearch(g.title);
        const first = results[0];
        if (first) {
          const d = await rawgDetail(first.id);
          if (d?.description_raw) {
            const fr = await frenchDescription(d.description_raw);
            if (fr) setGames(gs => gs.map(x => x.id === g.id ? { ...x, style: fr } : x));
          }
        }
      } catch {}
      setRefreshProg(i + 1);
      await new Promise(res => setTimeout(res, 150));
    }
    setRefreshing(false);
  };

  // Fetch covers + metacritic manquants au démarrage
  useEffect(() => {
    const fetchCovers = async () => {
      const missing = games.filter(g => !g.cover);
      for (const g of missing) {
        try {
          const r = await fetch(`https://api.rawg.io/api/games?key=${RAWG_KEY}&search=${encodeURIComponent(g.title)}&page_size=1`);
          const d = await r.json();
          const result = d.results?.[0];
          if (result) {
            setGames(gs => gs.map(x => x.id === g.id ? {
              ...x,
              cover: result.background_image || x.cover,
              metacritic: result.metacritic || x.metacritic,
            } : x));
            // Complète la description en français uniquement si absente (préserve les styles curatés)
            if (!g.style) {
              const detail = await rawgDetail(result.id);
              if (detail?.description_raw) {
                const style = await frenchDescription(detail.description_raw);
                if (style) setGames(gs => gs.map(x => x.id === g.id ? { ...x, style } : x));
              }
            }
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
  const addGame = (g) => { setGames(gs => [g, ...gs]); setShowAdd(false); };
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
    let list = games.filter(g => {
      const q = search.toLowerCase();
      const statusMatch = statFil === "tous" ? true
        : statFil === "à finir" ? (g.status === "en cours" || g.status === "non commencé")
        : g.status === statFil;
      return (!q || g.title.toLowerCase().includes(q) || g.genre.some(x => x.toLowerCase().includes(q)) || g.style.toLowerCase().includes(q))
        && (plat === "tous" || g.platform === plat)
        && statusMatch;
    });
    return list.sort((a, b) => {
      if (statFil === "à finir") return staleKey(a) - staleKey(b); // plus anciennes d'abord
      if (sort === "date") return new Date(b.addedDate) - new Date(a.addedDate);
      if (sort === "metacritic") return (b.metacritic||0) - (a.metacritic||0);
      if (sort === "temps") return (b.playedMinutes+b.manualMinutes) - (a.playedMinutes+a.manualMinutes);
      return a.title.localeCompare(b.title);
    });
  }, [games, search, plat, statFil, sort]);

  const stats = useMemo(() => {
    const total = games.length, termines = games.filter(g => g.status === "terminé").length;
    const enCours = games.filter(g => g.status === "en cours").length, pretes = games.filter(g => g.lentA).length;
    const totalTime = games.reduce((a, g) => a + g.playedMinutes + g.manualMinutes, 0);
    const byGenre = {}; games.forEach(g => g.genre.forEach(x => byGenre[x] = (byGenre[x]||0) + 1));
    const topGenres = Object.entries(byGenre).sort((a,b) => b[1]-a[1]).slice(0,6);
    return { total, termines, enCours, pretes, totalTime, topGenres };
  }, [games]);

  const lentGames = games.filter(g => g.lentA);

  const bg = dark ? "#0f0f1a" : "#e8eef8";
  const hdr = dark ? "#12122a" : "#dde6f8";
  const bdr = dark ? "#2a2a4a" : "#c8d4ec";
  const txt = dark ? "#e2e8f0" : "#1e2a4a";
  const mut = dark ? "#64748b" : "#8090b0";
  const inpBg = dark ? "#1a1a2e" : "#f0f4ff";

  const emptyState = (
    <div style={{ textAlign: "center", padding: "70px 20px", color: mut }}>
      <div style={{ fontSize: 56, marginBottom: 12, opacity: 0.85 }}>🎮</div>
      <div style={{ color: txt, fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Aucun jeu trouvé</div>
      <div style={{ fontSize: 12 }}>Essaie un autre terme ou change les filtres 🔍</div>
    </div>
  );

  return (
    <div style={{ background: bg, minHeight: "100vh", fontFamily: "'Inter','Segoe UI',sans-serif", color: txt }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'); @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}} @keyframes statusPop{from{opacity:0;transform:scale(0.75)}to{opacity:1;transform:scale(1)}} @keyframes toastIn{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}} *{box-sizing:border-box}`}</style>

      {/* Header */}
      <div style={{ background: hdr, borderBottom: `1px solid ${bdr}`, padding: "12px 14px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: "#5493FF", lineHeight: 1.4 }}>GAME LIBRARY</div>
            <div style={{ fontSize: 10, color: mut, marginTop: 2 }}>{stats.total} jeux · {stats.termines} terminés · {stats.enCours} en cours</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button onClick={refreshAllDescriptions} disabled={refreshing} title="Actualiser toutes les descriptions (traduction FR via RAWG)" style={{ background: "transparent", border: `1px solid ${bdr}`, color: refreshing ? "#5493FF" : mut, borderRadius: 6, padding: "5px 8px", fontSize: 11, cursor: refreshing ? "default" : "pointer", opacity: refreshing ? 0.8 : 1, whiteSpace: "nowrap" }}>
              {refreshing ? `⏳ ${refreshProg}/${games.length} traduits` : "🌐 Actualiser descriptions"}
            </button>
            <button onClick={() => setDark(!dark)} style={{ background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: 6, padding: "5px 8px", fontSize: 12, cursor: "pointer" }}>{dark ? "☀️" : "🌙"}</button>
            <button onClick={() => setShowAdd(true)} style={{ background: "#5493FF", color: "#fff", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Ajouter</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {[["library","Bibliothèque"],["loans",`Prêts${lentGames.length ? ` (${lentGames.length})` : ""}`],["stats","Stats"]].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ background: tab===k?"#5493FF":"transparent", border:`1px solid ${tab===k?"#5493FF":bdr}`, color: tab===k?"#fff":mut, borderRadius:6, padding:"4px 10px", fontSize:11, cursor:"pointer" }}>{l}</button>
          ))}
        </div>

        {tab === "library" && <>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher titre, genre, tag…" style={{ background: inpBg, border:`1px solid ${bdr}`, borderRadius:8, color:txt, padding:"7px 12px", fontSize:13, outline:"none", width:"100%", marginBottom:8 }} />
          <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:6 }}>
            {PLATFORMS.map(p => <button key={p} onClick={() => setPlat(p)} style={{ background:plat===p?"#5493FF22":"transparent", border:`1px solid ${plat===p?"#5493FF":bdr}`, color:plat===p?"#5493FF":mut, borderRadius:5, padding:"3px 8px", fontSize:10, cursor:"pointer" }}>{p==="tous"?"Toutes":p}</button>)}
          </div>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:6 }}>
            {["tous",...STATUTS,"à finir"].map(s => <button key={s} onClick={() => setStatFil(s)} style={{ background:statFil===s?(STATUS_COLORS[s]||"#5493FF")+"22":"transparent", border:`1px solid ${statFil===s?(STATUS_COLORS[s]||"#5493FF"):bdr}`, color:statFil===s?(STATUS_COLORS[s]||"#5493FF"):mut, borderRadius:5, padding:"3px 7px", fontSize:10, cursor:"pointer" }}>{s==="tous"?"Tous":s==="à finir"?"🎯 à finir":s}</button>)}
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
      <div style={{ padding:"14px 14px 60px" }}>
        {tab === "library" && (filtered.length === 0 ? emptyState : view === "grille" ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))", gap:10 }}>
            {filtered.map(g => (
              <div key={g.id} style={{ background:dark?"#1a1a2e":"#f0f4ff", border:`1px solid ${bdr}`, borderRadius:10, overflow:"hidden", cursor:"pointer", transition:"transform 0.15s, box-shadow 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.transform="scale(1.04)"; e.currentTarget.style.boxShadow="0 10px 24px rgba(0,0,0,0.45)"; e.currentTarget.style.zIndex="1"; e.currentTarget.style.position="relative"; }}
                onMouseLeave={e => { e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.boxShadow="none"; e.currentTarget.style.zIndex="auto"; }}
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
            {filtered.map(g => <GameCard key={g.id} g={g} onEdit={edit} onDelete={deleteGame} onEnrich={enrichGame} activeTimer={activeTimer} onStartTimer={startTimer} onStopTimer={stopTimer} dark={dark} />)}
          </div>
        ))}

        {tab === "loans" && (
          <div>
            {lentGames.length === 0 ? <div style={{ textAlign:"center", color:mut, padding:"60px 0" }}>Aucun jeu prêté actuellement</div>
            : lentGames.map(g => {
              const days = g.lentDate ? Math.floor((Date.now()-new Date(g.lentDate))/86400000) : null;
              return (
                <div key={g.id} style={{ background:dark?"#1a1a2e":"#f0f4ff", border:`1px solid ${days>30?"#ef4444":bdr}`, borderRadius:10, padding:"12px", marginBottom:8, display:"flex", gap:10, alignItems:"center" }}>
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

        {tab === "stats" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
              {[["Total",stats.total,"#5493FF"],["Terminés",`${stats.termines} (${Math.round(stats.termines/stats.total*100)}%)`,"#22c55e"],["En cours",stats.enCours,"#5493FF"],["Prêtés",stats.pretes,"#f59e0b"],["Temps total",fmtTime(stats.totalTime),"#a855f7"]].map(([l,v,c]) => (
                <div key={l} style={{ background:dark?"#1a1a2e":"#f0f4ff", border:`1px solid ${bdr}`, borderRadius:10, padding:"12px 14px" }}>
                  <div style={{ color:mut, fontSize:10 }}>{l}</div>
                  <div style={{ color:c, fontSize:20, fontWeight:700, marginTop:2 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ background:dark?"#1a1a2e":"#f0f4ff", border:`1px solid ${bdr}`, borderRadius:10, padding:14, marginBottom:16 }}>
              <div style={{ color:txt, fontWeight:600, fontSize:13, marginBottom:10 }}>Top genres</div>
              {stats.topGenres.map(([genre,count]) => (
                <div key={genre} style={{ marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}><span style={{ color:txt, fontSize:12 }}>{genre}</span><span style={{ color:mut, fontSize:11 }}>{count}</span></div>
                  <div style={{ height:4, background:dark?"#2a2a4a":"#d0d8f0", borderRadius:2 }}><div style={{ width:`${count/stats.total*100}%`, height:"100%", background:"#5493FF", borderRadius:2 }} /></div>
                </div>
              ))}
            </div>
            <div style={{ background:dark?"#1a1a2e":"#f0f4ff", border:`1px solid ${bdr}`, borderRadius:10, padding:14 }}>
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

      {showAdd && <AddModal dark={dark} onAdd={addGame} onClose={() => setShowAdd(false)} />}

      {deleted && (
        <div style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)", zIndex:400, display:"flex", alignItems:"center", gap:14, background:dark?"#1a1a2e":"#f0f4ff", border:`1px solid ${bdr}`, borderRadius:10, padding:"10px 14px", boxShadow:"0 8px 24px rgba(0,0,0,0.4)", animation:"toastIn 200ms ease" }}>
          <span style={{ color:txt, fontSize:13 }}>🗑 « {deleted.game.title} » supprimé</span>
          <button onClick={undoDelete} style={{ background:"transparent", border:"1px solid #5493FF", color:"#5493FF", borderRadius:6, padding:"4px 12px", fontSize:12, fontWeight:600, cursor:"pointer" }}>Annuler</button>
        </div>
      )}
    </div>
  );
}

