import { useState, useMemo, useEffect, useRef, useCallback } from "react";

import Cover from "./components/Cover.jsx";
import GameCard from "./components/GameCard.jsx";
import AddModal from "./components/AddModal.jsx";
import ImportModal from "./components/ImportModal.jsx";
import FiltersSheet from "./components/FiltersSheet.jsx";
import ActionsSheet from "./components/ActionsSheet.jsx";
import ScoresSheet from "./components/ScoresSheet.jsx";
import StatsView from "./components/StatsView.jsx";
import SettingsView from "./components/SettingsView.jsx";

import { hdr, card, bdr, txt, mut } from "./lib/theme.js";
import { GAMES_INIT } from "./lib/seed.js";
import { BACK_COMPAT, migrateGames, compterFiltres, validerJeuxImportes, pretEnRetard, jeuxSansScore,
  dureeEntreeHistorique, supprimerEntreeHistorique } from "./lib/model.js";
import { lire, ecrire, surEchecStockage } from "./lib/storage.js";
import { chargerSync, enregistrerSync, genererCode, envoyer, recuperer } from "./lib/sync.js";
import { surMiseAJour } from "./lib/maj.js";
import { resoudreTheme, modeSuivant, modeValide, ICONES, LIBELLES } from "./lib/apparence.js";
import {
  loadKeys, setApiKeys, normTitle, hasRawgKey, rawgFirstResult,
  rawgSearch, rawgDetail, wikiFrenchTitles, wikiArticleData, pickBestWikiTitle,
  sgdbSearch, xblTitleHistory,
} from "./lib/api.js";

// Nombre de jeux rendus d'un coup. La liste entière était montée à chaque
// rendu : à 94 jeux, autant de GameCard portant chacun ~25 useState, soit
// plusieurs milliers de hooks et autant d'objets de style recréés.
const PAGE_SIZE = 30;

// Jaquettes rattrapées au démarrage, par ouverture de l'application.
const RATTRAPAGE_MAX = 12;

const ACCENT = "#5493FF";

// Bouton d'en-tête : même gabarit pour tous, à la hauteur de cible tactile.
const btnHdr = {
  minHeight: "var(--tap)", minWidth: "var(--tap)", background: "transparent",
  border: `1px solid ${bdr}`, color: txt, borderRadius: 10, padding: "0 12px",
  fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center",
  justifyContent: "center", gap: 6, flexShrink: 0,
};

export default function App() {
  const [games, setGames] = useState(() => { try { const s = lire("gl_v2"); return migrateGames(s ? JSON.parse(s) : GAMES_INIT); } catch { return migrateGames(GAMES_INIT); } });
  // `searchInput` suit la frappe, `search` ne la rattrape qu'après 180 ms :
  // sans ce délai, chaque caractère refiltrait et remontait toute la liste.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [plat, setPlat] = useState("tous");
  const [pretFil, setPretFil] = useState("tous");
  const [fmtFil, setFmtFil] = useState("tous");
  const [sort, setSort] = useState("titre");
  const [view, setView] = useState("liste");
  const [tab, setTab] = useState("library");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [keys, setKeys] = useState(() => loadKeys());   // clés API saisies par l'utilisateur
  const [keyTest, setKeyTest] = useState({});           // résultat du bouton « Tester »
  const [importedIds, setImportedIds] = useState([]); // pour l'enrichissement post-import (E)
  const [enriching, setEnriching] = useState(false);
  const [enrichProg, setEnrichProg] = useState(0);
  const enrichCancelRef = useRef(false);
  const [lastAddedId, setLastAddedId] = useState(null);
  // Fiche à ouvrir et à faire défiler à l'écran. Un clic sur une vignette de la
  // vue grille écrivait auparavant le titre du jeu dans la recherche puis
  // l'effaçait deux secondes plus tard : si on commençait à taper pendant ce
  // délai, le texte disparaissait sous les doigts.
  const [focusId, setFocusId] = useState(null);
  // Le thème est persisté : il repartait en sombre à chaque rechargement.
  // index.html le pose sur <html> avant le premier rendu pour éviter le clignotement.
  // Trois modes, pas deux : « automatique » suit le réglage du téléphone, qui
  // bascule tout seul le soir. Les anciennes valeurs "light"/"dark" restent
  // valides et gardent leur sens — un choix explicite tient.
  const [modeTheme, setModeTheme] = useState(() => modeValide(lire("gl_theme")));
  const [systemeSombre, setSystemeSombre] = useState(
    () => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches
  );
  const theme = resoudreTheme(modeTheme, systemeSombre);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProg, setRefreshProg] = useState(0);
  const [refreshMsg, setRefreshMsg] = useState(null); // bilan de fin de refresh (S1)
  const refreshCancelRef = useRef(false); // annulation du refresh global (S6)
  // Complétion des notes Metacritic manquantes.
  const [scoresEnCours, setScoresEnCours] = useState(false);
  const [scoresProg, setScoresProg] = useState(0);
  const [scoresTotal, setScoresTotal] = useState(0);
  const [scoresBilan, setScoresBilan] = useState(null); // { trouves, sansScore, stopped } ou { message }
  const scoresCancelRef = useRef(false);
  const [deleted, setDeleted] = useState(null); // { game, index } pour l'undo
  const [alerteStockage, setAlerteStockage] = useState(null);
  const [majDispo, setMajDispo] = useState(false);
  const [sync, setSync] = useState(() => chargerSync());
  const [syncEtat, setSyncEtat] = useState(null);   // { type: "ok" | "ko" | "…", texte }
  const undoRef = useRef(null);

  // La bibliothèque entière était sérialisée à chaque changement de `games`.
  // Taper une note de 200 caractères déclenchait 200 écritures d'environ
  // 136 Ko, soit 27 Mo poussés dans le stockage pour une phrase. Un délai de
  // 400 ms ramène ça à une écriture par pause de frappe.
  //
  // `pagehide` complète le délai : sans lui, fermer l'onglet dans les 400 ms
  // qui suivent la dernière frappe perdrait la modification. Il se déclenche
  // aussi quand Android met la PWA en arrière-plan, cas le plus fréquent.
  const gamesRef = useRef(games);
  gamesRef.current = games;
  useEffect(() => {
    const enregistrer = () => ecrire("gl_v2", JSON.stringify(gamesRef.current));
    const t = setTimeout(enregistrer, 400);
    window.addEventListener("pagehide", enregistrer);
    return () => { clearTimeout(t); window.removeEventListener("pagehide", enregistrer); };
  }, [games]);

  // Une écriture qui échoue doit se voir : sinon on continue à noter et à
  // chronométrer dans une app qui ne garde plus rien.
  useEffect(() => surEchecStockage(setAlerteStockage), []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => { ecrire("gl_theme", modeTheme); }, [modeTheme]);

  // Le téléphone peut basculer pendant que l'application est ouverte — la nuit
  // tombe, ou l'économiseur de batterie s'enclenche. En mode automatique, elle
  // doit suivre sans qu'on la relance.
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const suivre = e => setSystemeSombre(e.matches);
    mq.addEventListener("change", suivre);
    return () => mq.removeEventListener("change", suivre);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 180);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Toute pagination repart du début quand le contenu de la liste change :
  // sinon « Charger 30 de plus » resterait déplié sur un résultat de 3 jeux.
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, plat, pretFil, fmtFil, sort, tab, view]);

  // Recherche posée par le code (clic sur une vignette, retour d'un ajout) :
  // les deux états doivent bouger ensemble, sans attendre le délai de frappe.
  const applySearch = (v) => { setSearchInput(v); setSearch(v); };

  // Actualise la description de tous les jeux depuis Wikipédia FR :
  // recherche full-text -> résumé (extract) du 1er article -> champ style.
  // Annulable (S6) ; garde un délai anti-rate-limit ; log des jeux sans page (S1).
  const refreshAllDescriptions = async () => {
    if (refreshing) return;
    // Cette opération REMPLACE chaque description existante, y compris celles
    // corrigées à la main. Elle se présentait comme une simple actualisation.
    const ecrites = games.filter(g => g.style).length;
    if (ecrites && !window.confirm(
      `Recharger les descriptions des ${games.length} jeux depuis Wikipédia ?\n\n` +
      `${ecrites} description(s) existante(s) seront remplacées, y compris celles que tu as écrites ou corrigées toi-même.`
    )) return;
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

  // Une ligne d'historique fausse — un essai, une saisie ratée — fausse les
  // moyennes pour toujours si rien ne peut l'effacer.
  const supprimerPretPasse = (jeuId, index, e) => {
    if (!window.confirm(`Supprimer ce prêt à ${e.a} de l'historique ?\n\nIl ne comptera plus dans les statistiques. Cette suppression est définitive.`)) return;
    setGames(gs => gs.map(g => (g.id === jeuId ? supprimerEntreeHistorique(g, index) : g)));
  };

  // Complète les notes Metacritic absentes depuis RAWG, sans toucher à celles
  // déjà renseignées.
  //
  // Le rattrapage du démarrage ne vise que les jeux sans jaquette et ne prend
  // la note qu'au passage : un jeu illustré mais sans note n'était jamais
  // repêché. Et l'enrichissement de masse ne concerne que les jeux fraîchement
  // importés, donc jamais la bibliothèque déjà en place.
  const completerScores = async () => {
    if (scoresEnCours) return;
    if (!hasRawgKey()) { setScoresBilan({ message: "Aucune clé RAWG n'est configurée — voir Réglages." }); return; }
    const cibles = jeuxSansScore(games);
    if (!cibles.length) { setScoresBilan({ message: "Tous les jeux ont déjà une note." }); return; }

    scoresCancelRef.current = false;
    setScoresEnCours(true);
    setScoresProg(0);
    setScoresTotal(cibles.length);
    setScoresBilan(null);
    const trouves = [];
    const sansScore = [];
    for (let i = 0; i < cibles.length; i++) {
      if (scoresCancelRef.current) break;
      const g = cibles[i];
      try {
        const r = await rawgFirstResult(g.title);
        if (r?.metacritic) {
          setGames(gs => gs.map(x => x.id === g.id ? { ...x, metacritic: r.metacritic } : x));
          trouves.push({ id: g.id, titre: g.title, titreRawg: r.name, score: r.metacritic });
        } else sansScore.push(g.title);
      } catch { sansScore.push(g.title); }
      setScoresProg(i + 1);
      await new Promise(res => setTimeout(res, 150)); // sous la limite de RAWG
    }
    setScoresEnCours(false);
    setScoresBilan({ trouves, sansScore, stopped: scoresCancelRef.current });
  };
  const annulerScores = () => { scoresCancelRef.current = true; };
  // Le bilan laisse retirer une note issue d'un mauvais rapprochement.
  const retirerScore = useCallback((id) => {
    setGames(gs => gs.map(g => g.id === id ? { ...g, metacritic: null } : g));
    setScoresBilan(b => (b?.trouves ? { ...b, trouves: b.trouves.filter(t => t.id !== id) } : b));
  }, []);

  // Une version plus récente est déjà installée, mais cet onglet exécute
  // encore l'ancienne : le seul remède est un rechargement, autant le dire.
  useEffect(() => surMiseAJour(() => setMajDispo(true)), []);

  // Fetch covers + metacritic manquants au démarrage
  useEffect(() => {
    const fetchCovers = async () => {
      if (!hasRawgKey()) return;   // pas de clé RAWG configurée -> on ne tente rien
      // Plafonné : sans limite, une bibliothèque fraîchement importée lançait
      // une centaine de requêtes séquentielles à CHAQUE ouverture de l'app,
      // soit une dizaine de secondes de réseau, y compris après dix échecs.
      // Le reste se rattrape à l'ouverture suivante, ou via « Actualiser ».
      const missing = games.filter(g => !g.cover).slice(0, RATTRAPAGE_MAX);
      for (const g of missing) {
        try {
          const result = await rawgFirstResult(g.title);
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

  // Références stables : sans ça, chaque rendu d'App fabriquerait de nouvelles
  // fonctions et le memo() des fiches ne servirait à rien.
  const edit = useCallback((id, field, val) => setGames(gs => gs.map(g => g.id === id ? { ...g, [field]: val } : g)), []);
  const enrichGame = useCallback((id, data) => setGames(gs => gs.map(g => g.id === id ? { ...g, ...data } : g)), []);
  // Ajoute le jeu puis l'ouvre directement en fiche complète (parité fiche/ajout).
  const addGame = (g) => {
    setGames(gs => [g, ...gs]);
    setShowAdd(false);
    setLastAddedId(g.id);
    setTab("library");
    setView("liste");
    setPlat("tous");
    setPretFil("tous");
    applySearch("");
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
    setPretFil("tous");
    applySearch("");
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
  const deleteGame = useCallback((g) => {
    // Le toast d'annulation ne dure que cinq secondes : passé ce délai, le jeu
    // et son historique de prêts sont perdus sans recours.
    if (!window.confirm(`Supprimer « ${g.title} » ?${(g.pretsPasses || []).length ? `\n\nSon historique de ${g.pretsPasses.length} prêt(s) disparaît avec lui.` : ""}`)) return;
    const index = games.findIndex(x => x.id === g.id);
    setGames(gs => gs.filter(x => x.id !== g.id));
    setDeleted({ game: g, index });
    clearTimeout(undoRef.current);
    undoRef.current = setTimeout(() => setDeleted(null), 5000);
  }, [games]);
  const undoDelete = () => {
    if (!deleted) return;
    clearTimeout(undoRef.current);
    setGames(gs => { const c = [...gs]; c.splice(Math.min(deleted.index, c.length), 0, deleted.game); return c; });
    setDeleted(null);
  };

  // ── Sauvegarde sur le Worker ───────────────────────────────────────────
  const majSync = (v) => { setSync(v); enregistrerSync(v); };

  const envoyerAuCloud = async (base = sync.majLe) => {
    setSyncEtat({ type: "…", texte: "Envoi en cours…" });
    const r = await envoyer(keys.proxy, sync.code, games, base);

    // Un autre appareil a envoyé depuis notre dernière synchronisation. Écraser
    // détruirait son travail : on pose le choix, chiffres en main, au lieu de
    // décider à la place de l'utilisateur.
    if (!r.ok && r.conflit) {
      const quand = r.data?.updatedAt ? new Date(r.data.updatedAt).toLocaleString("fr-FR") : "date inconnue";
      const ecraser = window.confirm(
        `Un autre appareil a envoyé sa bibliothèque depuis ta dernière synchronisation.\n\n` +
        `Sur le relais : ${r.data?.count ?? "?"} jeu(x), enregistrés le ${quand}.\n` +
        `Sur cet appareil : ${games.length} jeu(x).\n\n` +
        `OK = écraser le relais avec cet appareil\n` +
        `Annuler = ne rien envoyer (récupère d'abord pour comparer)`
      );
      if (!ecraser) { setSyncEtat({ type: "ko", texte: "Envoi annulé — récupère d'abord pour ne rien perdre." }); return; }
      return envoyerAuCloud("force");
    }

    if (!r.ok) { setSyncEtat({ type: "ko", texte: r.erreur }); return; }
    majSync({ ...sync, majLe: r.data?.updatedAt || new Date().toISOString() });
    setSyncEtat({ type: "ok", texte: `${games.length} jeux sauvegardés.` });
  };

  // Vérifie qu'une clé répond, sans quitter les réglages.
  const testerCle = async (id) => {
    setKeyTest(t => ({ ...t, [id]: "…" }));
    let ok = false;
    try {
      if (id === "rawg") ok = (await rawgSearch("halo")).length > 0;
      if (id === "sgdb") ok = (await sgdbSearch("halo")).length > 0;
      if (id === "xbl") ok = (await xblTitleHistory()).length > 0;
    } catch { /* une clé refusée n'est pas une erreur de l'application */ }
    setKeyTest(t => ({ ...t, [id]: ok ? "ok" : "ko" }));
  };

  const recupererDuCloud = async () => {
    setSyncEtat({ type: "…", texte: "Récupération…" });
    const r = await recuperer(keys.proxy, sync.code);
    if (!r.ok) { setSyncEtat({ type: "ko", texte: r.erreur }); return; }

    const distants = Array.isArray(r.data?.games) ? r.data.games : null;
    if (!distants) { setSyncEtat({ type: "ko", texte: "Sauvegarde illisible." }); return; }

    // On valide la sauvegarde distante comme un import de fichier : elle a été
    // écrite par une autre version de l'app, peut-être plus ancienne.
    const { jeux, rejetes } = validerJeuxImportes(distants);
    const quand = r.data.updatedAt ? new Date(r.data.updatedAt).toLocaleString("fr-FR") : "date inconnue";

    // Un remplacement écrase du travail local : il se confirme, chiffres en main.
    const ok = window.confirm(
      `Sauvegarde du ${quand} : ${jeux.length} jeu(x).\n` +
      `Cet appareil en compte ${games.length}.` +
      (rejetes ? `\n\n⚠️ ${rejetes} entrée(s) ignorée(s).` : "") +
      `\n\nRemplacer la bibliothèque de cet appareil ?`
    );
    if (!ok) { setSyncEtat({ type: "ko", texte: "Récupération annulée." }); return; }
    setGames(jeux);
    majSync({ ...sync, majLe: r.data.updatedAt || null });
    setSyncEtat({ type: "ok", texte: `${jeux.length} jeux récupérés.` });
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
      let data;
      try { data = JSON.parse(reader.result); }
      catch { alert("Ce fichier n'est pas du JSON valide."); return; }

      const { jeux, rejetes } = validerJeuxImportes(data);
      if (!jeux) { alert("Ce fichier ne contient pas une liste de jeux."); return; }
      if (!jeux.length) { alert(`Aucun jeu exploitable dans ce fichier${rejetes ? ` (${rejetes} entrée(s) ignorée(s))` : ""}.`); return; }

      const avertissement = rejetes ? `\n\n⚠️ ${rejetes} entrée(s) sans titre ont été ignorées.` : "";
      const replace = window.confirm(
        `Fichier : ${jeux.length} jeu(x) valides.${avertissement}\n\nOK = REMPLACER toute la bibliothèque\nAnnuler = FUSIONNER (ajoute uniquement les jeux absents)`
      );
      if (replace) setGames(jeux);
      else setGames(gs => { const ids = new Set(gs.map(x => x.id)); return [...gs, ...jeux.filter(x => !ids.has(x.id))]; });
    };
    reader.onerror = () => alert("Lecture du fichier impossible.");
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
      const pretMatch = pretFil === "tous" ? true
        : pretFil === "prêtés" ? !!g.lentA
        : !g.lentA;
      return searchMatch
        && platMatch
        && (fmtFil === "tous" || g.format === fmtFil)
        && pretMatch;
    });
    return list.sort((a, b) => {
      if (sort === "date") return new Date(b.addedDate) - new Date(a.addedDate);
      if (sort === "metacritic") return (b.metacritic||0) - (a.metacritic||0);
      return a.title.localeCompare(b.title);
    });
  }, [games, search, plat, pretFil, fmtFil, sort]);

  const stats = useMemo(() => {
    const total = games.length;
    const pretes = games.filter(g => g.lentA).length;
    const enRetard = games.filter(pretEnRetard).length;
    // Seul l'en-tête s'en sert encore : le détail vit dans StatsView.
    return { total, pretes, enRetard };
  }, [games]);

  const lentGames = games.filter(g => g.lentA);
  // Tous les prêts rendus, jeu par jeu, du plus récent au plus ancien.
  const historique = useMemo(() => games
    .flatMap(g => (g.pretsPasses || []).map((e, i) => ({ ...e, titre: g.title, jeuId: g.id, index: i })))
    .sort((a, b) => (a.au < b.au ? 1 : a.au > b.au ? -1 : 0))
    .slice(0, 50), [games]);
  const filtresActifs = compterFiltres({ plat, pretFil, fmtFil });

  // Ce qui est réellement monté. Le reste attend « Charger 30 de plus ».
  const visible = filtered.slice(0, visibleCount);
  const restants = filtered.length - visible.length;
  const chargerPlus = restants > 0 && (
    <button
      onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
      style={{
        width: "100%", minHeight: "var(--tap)", marginTop: 12, background: "transparent",
        border: `1px solid ${bdr}`, color: txt, borderRadius: 10, fontSize: 13, cursor: "pointer",
      }}
    >
      Charger {Math.min(PAGE_SIZE, restants)} de plus ({restants} restant{restants > 1 ? "s" : ""})
    </button>
  );

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: ACCENT, lineHeight: 1.4 }}>GAME LIBRARY</div>
            {/* La ligne répond aux deux questions que l'application sert à poser :
                combien de jeux, et combien sont dehors. */}
            <div style={{ fontSize: 10, color: mut, marginTop: 3 }}>
              {stats.total} jeu{stats.total > 1 ? "x" : ""}{stats.pretes > 0 ? ` · ${stats.pretes} prêté${stats.pretes > 1 ? "s" : ""}` : ""}
              {stats.enRetard > 0 ? <span style={{ color: "#f59e0b" }}> · {stats.enRetard} en retard</span> : null}
            </div>
          </div>
          {/* Deux boutons seulement. Les quatre actions à libellé complet qui
              tenaient ici débordaient de l'écran de 13 px : elles sont passées
              dans le panneau « Actions ». */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <button onClick={() => setModeTheme(modeSuivant)}
              aria-label={`Thème : ${LIBELLES[modeTheme]}`} title={`Thème : ${LIBELLES[modeTheme]}`}
              style={{ ...btnHdr, color: txt }}>
              {ICONES[modeTheme]}
            </button>
            <button onClick={() => setShowActions(true)} aria-label="Actions" title="Actions"
              style={{ ...btnHdr, color: refreshing || enriching ? ACCENT : txt, borderColor: refreshing || enriching ? ACCENT : bdr }}>
              {refreshing || enriching ? "⏳" : "⋯"}
            </button>
            <button onClick={() => setShowAdd(true)}
              style={{ ...btnHdr, background: ACCENT, border: "none", color: "#fff", fontSize: 13, fontWeight: 600 }}>
              + Ajouter
            </button>
          </div>
        </div>

        {alerteStockage && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#ef444422", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0, color: "#ef4444", fontSize: 11, fontWeight: 600, lineHeight: 1.4 }}>⚠️ {alerteStockage}</div>
            <button onClick={() => setAlerteStockage(null)} aria-label="Masquer" style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: 14, cursor: "pointer", lineHeight: 1, padding: 0 }}>✕</button>
          </div>
        )}

        {scoresEnCours && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: card, border: `1px solid ${bdr}`, borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0, color: txt, fontSize: 11, fontWeight: 600 }}>Recherche des notes… {scoresProg}/{scoresTotal}</div>
            <button onClick={annulerScores} style={{ background: "#ef444422", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>Arrêter</button>
          </div>
        )}

        {scoresBilan?.message && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: card, border: `1px solid ${bdr}`, borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0, color: txt, fontSize: 11, fontWeight: 600 }}>{scoresBilan.message}</div>
            <button onClick={() => setScoresBilan(null)} aria-label="Masquer" style={{ background: "transparent", border: "none", color: mut, fontSize: 14, cursor: "pointer", lineHeight: 1, padding: 0 }}>✕</button>
          </div>
        )}

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

        {/* Onglets : pleine largeur, à la hauteur de cible tactile. */}
        <div style={{ display: "flex", gap: 6, marginBottom: tab === "library" ? 10 : 0 }}>
          {[["library","Bibliothèque"],["loans",`Prêts${lentGames.length ? ` (${lentGames.length})` : ""}`],["stats","Stats"],["settings","⚙️"]].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
              style={{
                flex: k === "settings" ? "0 0 auto" : 1, minWidth: k === "settings" ? "var(--tap)" : 0,
                minHeight: "var(--tap)", background: tab===k ? ACCENT : "transparent",
                border: `1px solid ${tab===k ? ACCENT : bdr}`, color: tab===k ? "#fff" : mut,
                borderRadius: 10, padding: "0 8px", fontSize: 12, fontWeight: tab===k ? 600 : 400,
                cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{l}</button>
          ))}
        </div>

        {/* Recherche + accès aux filtres. Les quatre rangées de puces qui
            occupaient cette place sont dans le panneau « Filtres » ; le badge
            dit combien sont appliquées sans avoir à l'ouvrir. */}
        {tab === "library" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)} type="search"
              placeholder="Rechercher titre, genre, tag…"
              style={{ flex: 1, minWidth: 0, minHeight: "var(--tap)", background: card, border: `1px solid ${bdr}`, borderRadius: 10, color: txt, padding: "0 12px", fontSize: 14, outline: "none" }} />
            <button onClick={() => setShowFilters(true)}
              style={{ ...btnHdr, borderColor: filtresActifs ? ACCENT : bdr, color: filtresActifs ? ACCENT : txt, fontSize: 13 }}>
              Filtres{filtresActifs > 0 && <span style={{ background: ACCENT, color: "#fff", borderRadius: 9, padding: "1px 6px", fontSize: 11, fontWeight: 700 }}>{filtresActifs}</span>}
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding:"14px calc(14px + var(--safe-right)) calc(60px + var(--safe-bottom)) calc(14px + var(--safe-left))" }}>
        {tab === "library" && (filtered.length === 0 ? emptyState : view === "grille" ? (
          <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))", gap:10 }}>
            {visible.map(g => (
              <div key={g.id} className="gl-tile" style={{ background:card, border:`1px solid ${bdr}`, borderRadius:10, overflow:"hidden", cursor:"pointer" }}
                onClick={() => { setView("liste"); setFocusId(g.id); }}>
                <Cover src={g.cover} title={g.title} size="100%" />
                <div style={{ height:3, background:g.lentA ? "#f59e0b" : "transparent" }} />
                <div style={{ padding:"6px 7px" }}>
                  <div style={{ color:txt, fontSize:10, fontWeight:600, lineHeight:1.3, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{g.title}</div>
                  {g.metacritic && <div style={{ color:g.metacritic>=80?"#22c55e":"#f59e0b", fontSize:9, marginTop:2 }}>MC {g.metacritic}</div>}
                </div>
              </div>
            ))}
          </div>
          {chargerPlus}
          </>
        ) : (
          <>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {visible.map(g => <GameCard key={g.id} g={g} onEdit={edit} onDelete={deleteGame} onEnrich={enrichGame} autoOpen={g.id === lastAddedId || g.id === focusId} />)}
          </div>
          {chargerPlus}
          </>
        ))}

        {tab === "loans" && (
          <div>
            {lentGames.length === 0 ? <div style={{ textAlign:"center", color:mut, padding:"40px 0" }}>Aucun jeu prêté actuellement</div>
            : lentGames.map(g => {
              const days = g.lentDate ? Math.floor((Date.now()-new Date(g.lentDate))/86400000) : null;
              // Le seuil était réécrit ici en dur : la date de retour convenue
              // n'aurait rien changé pour cet onglet.
              const tard = pretEnRetard(g);
              return (
                <div key={g.id} style={{ background:card, border:`1px solid ${tard?"#ef4444":bdr}`, borderRadius:10, padding:"12px", marginBottom:8, display:"flex", gap:10, alignItems:"center" }}>
                  <Cover src={g.cover} title={g.title} size={52} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:txt, fontWeight:600, fontSize:13 }}>{g.title}</div>
                    <div style={{ color:"#f59e0b", fontSize:12 }}>📤 {g.lentA}</div>
                    {days!==null && (
                      <div style={{ color:tard?"#ef4444":mut, fontSize:11 }}>
                        {days}j
                        {g.lentRetourPrevu
                          ? ` · à rendre le ${new Date(g.lentRetourPrevu).toLocaleDateString("fr-FR")}`
                          : ""}
                        {tard ? " ⚠️" : ""}
                      </div>
                    )}
                  </div>
                  <a href={`sms:?body=${encodeURIComponent(`Salut ! Tu penses à me rendre ${g.title} ? 😊`)}`} style={{ background:"#f59e0b22", border:"1px solid #f59e0b", color:"#f59e0b", borderRadius:6, padding:"5px 10px", fontSize:11, textDecoration:"none" }}>SMS</a>
                </div>
              );
            })}

            {/* Les retours effaçaient toute trace du prêt. L'onglet ne montrait
                donc jamais que la moitié vivante d'un sujet qui a une suite. */}
            {historique.length > 0 && (
              <>
                <div style={{ color:txt, fontSize:12, fontWeight:600, margin:"18px 0 8px" }}>Déjà rendus</div>
                {historique.map((e, i) => (
                  <div key={i} style={{ display:"flex", gap:10, alignItems:"baseline", padding:"8px 2px", borderTop:`1px solid ${bdr}` }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:txt, fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.titre}</div>
                      <div style={{ color:mut, fontSize:11 }}>{e.a} · rendu le {new Date(e.au).toLocaleDateString("fr-FR")}</div>
                    </div>
                    <span style={{ color:mut, fontSize:11, flexShrink:0 }}>{dureeEntreeHistorique(e)} j</span>
                    <button onClick={() => supprimerPretPasse(e.jeuId, e.index, e)}
                      aria-label={`Supprimer le prêt de ${e.titre} à ${e.a}`} title="Supprimer de l'historique"
                      style={{ flexShrink:0, minWidth:32, minHeight:32, background:"transparent", border:"none", color:mut, fontSize:14, cursor:"pointer", lineHeight:1 }}>✕</button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === "settings" && (
          <SettingsView
            modeTheme={modeTheme} setModeTheme={setModeTheme}
            keys={keys} setKeys={setKeys}
            appliquerCles={{ actuelles: loadKeys(), appliquer: setApiKeys }}
            testerCle={testerCle} etatCles={keyTest}
            sync={sync} majSync={majSync} genererCode={genererCode}
            syncEtat={syncEtat} setSyncEtat={setSyncEtat}
            onEnvoyer={() => envoyerAuCloud()} onRecuperer={recupererDuCloud}
            onExporter={exportJSON} onImporter={importJSON}
          />
        )}

        {tab === "stats" && <StatsView games={games} />}
      </div>

      {showAdd && <AddModal onAdd={addGame} onClose={() => setShowAdd(false)} />}
      {showImport && <ImportModal games={games} onImportGames={importGames} onClose={() => setShowImport(false)} />}
      {showFilters && (
        <FiltersSheet
          plat={plat} setPlat={setPlat}
          pretFil={pretFil} setPretFil={setPretFil}
          fmtFil={fmtFil} setFmtFil={setFmtFil}
          sort={sort} setSort={setSort}
          view={view} setView={setView}
          resultats={filtered.length}
          onClose={() => setShowFilters(false)}
        />
      )}
      {showActions && (
        <ActionsSheet
          onClose={() => setShowActions(false)}
          onRefreshDescriptions={refreshAllDescriptions}
          refreshing={refreshing}
          refreshProg={refreshProg}
          refreshTotal={games.length}
          onCancelRefresh={cancelRefresh}
          onImportXbox={() => setShowImport(true)}
          onCompleterScores={completerScores}
          scoresEnCours={scoresEnCours}
          scoresProg={scoresProg}
          scoresTotal={scoresTotal}
          onAnnulerScores={annulerScores}
          scoresManquants={jeuxSansScore(games).length}
        />
      )}

      {scoresBilan && (scoresBilan.message
        ? null
        : <ScoresSheet bilan={scoresBilan} onAnnulerScore={retirerScore} onClose={() => setScoresBilan(null)} />)}

      {majDispo && (
        <div role="status" style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)", zIndex:401, display:"flex", alignItems:"center", gap:10, maxWidth:"calc(100vw - 24px)", background:card, border:"1px solid #5493FF", borderRadius:10, padding:"10px 14px", boxShadow:"0 8px 24px rgba(0,0,0,0.4)", animation:"toastIn 200ms ease" }}>
          {/* Sur 412 px, les trois éléments ne tiennent que si le libellé ne
              se casse pas : « installée » partait à la ligne, seul. */}
          <span style={{ color:txt, fontSize:13, whiteSpace:"nowrap" }}>✨ Nouvelle version</span>
          <button onClick={() => location.reload()} style={{ background:"#5493FF22", border:"1px solid #5493FF", color:"#5493FF", borderRadius:6, padding:"4px 12px", fontSize:12, fontWeight:600, cursor:"pointer" }}>Recharger</button>
          <button onClick={() => setMajDispo(false)} aria-label="Plus tard" style={{ background:"transparent", border:"none", color:mut, fontSize:14, cursor:"pointer", lineHeight:1, padding:0 }}>✕</button>
        </div>
      )}

      {deleted && (
        <div style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)", zIndex:400, display:"flex", alignItems:"center", gap:14, background:card, border:`1px solid ${bdr}`, borderRadius:10, padding:"10px 14px", boxShadow:"0 8px 24px rgba(0,0,0,0.4)", animation:"toastIn 200ms ease" }}>
          <span style={{ color:txt, fontSize:13 }}>🗑 « {deleted.game.title} » supprimé</span>
          <button onClick={undoDelete} style={{ background:"transparent", border:"1px solid #5493FF", color:"#5493FF", borderRadius:6, padding:"4px 12px", fontSize:12, fontWeight:600, cursor:"pointer" }}>Annuler</button>
        </div>
      )}
    </div>
  );
}

