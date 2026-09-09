import { useState, useMemo, useEffect, useRef, useCallback } from "react";

import Cover from "./components/Cover.jsx";
import GameCard from "./components/GameCard.jsx";
import AddModal from "./components/AddModal.jsx";
import ImportModal from "./components/ImportModal.jsx";
import FiltersSheet from "./components/FiltersSheet.jsx";
import ActionsSheet from "./components/ActionsSheet.jsx";
import ScoresSheet from "./components/ScoresSheet.jsx";
import Sheet from "./components/Sheet.jsx";
import StatsView from "./components/StatsView.jsx";
import SortSheet from "./components/SortSheet.jsx";
import SettingsView from "./components/SettingsView.jsx";

import { hdr, card, bdr, txt, mut, accent, accentDoux, accentFond, warnDoux, dangerDoux, ok, warn, warnFond, danger } from "./lib/theme.js";
import { GAMES_INIT } from "./lib/seed.js";
import { migrateGames, compterFiltres, FILTRES, validerJeuxImportes, pretEnRetard, jeuxSansScore, normaliserGenres,
  jeuALeMode, jeuSurPlateforme, compterRetro, genresPresents, dureeEntreeHistorique, supprimerEntreeHistorique,
  joursDePret, jeuPasseSeuil, jeuACompleter, completudeManquante, dateDeSortie, serieDuJeu,
  empreinteMelange, compterFichesIncompletes, PLATFORM_COLORS } from "./lib/model.js";
import { lire, ecrire, surEchecStockage } from "./lib/storage.js";
import { chargerSync, enregistrerSync, genererCode, envoyer, recuperer } from "./lib/sync.js";
import { preferencesASauvegarder, preferencesRecues, resumePreferences } from "./lib/preferences.js";
import { surMiseAJour } from "./lib/maj.js";
import { libelleTri, TRI_DEFAUT } from "./lib/tri.js";
import { texteListe, partagerTexte } from "./lib/partage.js";
import { resoudreTheme, modeSuivant, modeValide, ICONES, LIBELLES, COULEUR_BARRE } from "./lib/apparence.js";
import {
  loadKeys, setApiKeys, normTitle, hasRawgKey, rawgFirstResult,
  rawgSearch, rawgDetail, wikiFrenchTitles, wikiArticleData, pickBestWikiTitle,
  sgdbSearch, xblTitleHistory,
} from "./lib/api.js";

// Jaquettes rattrapées au démarrage, par ouverture de l'application.
const RATTRAPAGE_MAX = 12;

const ACCENT = accent;

// Croix de fermeture des bannières. Elles étaient dessinées sans cadre, sans
// remplissage et sans marge intérieure : la cible réelle valait la taille du
// glyphe, une dizaine de pixels de large, là où WCAG 2.5.8 demande 24 px et
// Material 48 dp. Les monter à 48 doublerait la hauteur d'une bannière ;
// `--tap-min` est le plancher retenu. Le glyphe ne bouge pas — c'est la zone
// sensible autour de lui qui grandit.
const btnFermer = {
  minWidth: "var(--tap-min)", minHeight: "var(--tap-min)", flexShrink: 0,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: "transparent", border: "none", borderRadius: "var(--r-sm)",
  fontSize: "var(--t-titre)", cursor: "pointer", lineHeight: 1, padding: 0,
};

// Bouton d'en-tête : même gabarit pour tous, à la hauteur de cible tactile.
const btnHdr = {
  minHeight: "var(--tap)", minWidth: "var(--tap)", background: "transparent",
  border: `1px solid ${bdr}`, color: txt, borderRadius: "var(--r-md)", padding: "0 12px",
  fontSize: "var(--t-titre)", cursor: "pointer", display: "inline-flex", alignItems: "center",
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
  const [genreFil, setGenreFil] = useState("tous");
  // Vrai par défaut : c'est le comportement d'avant, et celui qu'on veut quand
  // on cherche quoi lancer ce soir plutôt qu'à faire l'inventaire.
  const [avecRetro, setAvecRetro] = useState(true);
  const [noteFil, setNoteFil] = useState("tous");
  // Ce qu'il reste à remplir. L'onglet Stats savait le compter sans qu'on
  // puisse y aller : un constat sans porte de sortie.
  const [completFil, setCompletFil] = useState("tous");
  // Posée depuis une fiche, jamais depuis le panneau : cinquante-huit séries
  // ne tiennent pas dans une grille de boutons.
  const [serieFil, setSerieFil] = useState("tous");
  const [sortDir, setSortDir] = useState(1);
  // La graine du tri aléatoire. Elle ne change qu'à la demande, sinon la liste
  // se rebattrait sous le doigt à chaque frappe dans la recherche.
  const [graine, setGraine] = useState(() => Date.now() % 100000);
  const [groupePar, setGroupePar] = useState("aucun");
  const [modeFil, setModeFil] = useState("tous");
  const [sort, setSort] = useState(TRI_DEFAUT);
  const [view, setView] = useState("liste");
  const [tab, setTab] = useState("library");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [partageEtat, setPartageEtat] = useState(null);
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
  // Ces deux marqueurs n'ouvrent la fiche qu'UNE fois. Ils restaient posés
  // indéfiniment : quitter l'onglet puis y revenir démonte les fiches et les
  // remonte, si bien qu'une fiche refermée à la main se rouvrait toute seule,
  // sans qu'on comprenne pourquoi celle-là et pas une autre.
  const consommerOuverture = useCallback(() => { setFocusId(null); setLastAddedId(null); }, []);
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
  // Fichier lu et validé, en attente de la décision « remplacer ou fusionner ».
  const [importChoix, setImportChoix] = useState(null);
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
    // La barre d'état du téléphone suit le fond, sinon le bleu du manifeste
    // coiffe une application noire.
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COULEUR_BARRE[theme]);
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
  // Partage de la liste affichée. Pas de sélecteur de plateforme : les filtres
  // ont déjà composé la liste, et en redemander une seconde fois ferait deux
  // endroits où dire la même chose — qui finiraient par se contredire.
  const partagerListe = async () => {
    const filtree = filtered.length < games.length;
    const titre = filtree ? "Ma ludothèque (sélection)" : "Ma ludothèque";
    const quoi = await partagerTexte(texteListe(filtered, titre), titre);
    if (quoi === "annule") return;
    setPartageEtat(quoi === "copie" ? "Liste copiée — colle-la où tu veux."
      : quoi === "echec" ? "Impossible de copier la liste."
      : "Liste envoyée.");
  };

  const edit = useCallback((id, field, val) => setGames(gs => gs.map(g => g.id === id ? { ...g, [field]: val } : g)), []);
  const enrichGame = useCallback((id, data) => setGames(gs => gs.map(g => g.id === id ? { ...g, ...data } : g)), []);
  // Chaque filtre et le moyen de l'effacer, au même endroit. La table est
  // vérifiée contre `FILTRES` par un test : un filtre ajouté sans son
  // effacement fait échouer la CI au lieu de faire disparaître un jeu.
  const SETTEURS_FILTRE = {
    plat: setPlat, pretFil: setPretFil, fmtFil: setFmtFil, genreFil: setGenreFil,
    modeFil: setModeFil, noteFil: setNoteFil, completFil: setCompletFil, serieFil: setSerieFil,
  };

  // La rétrocompatibilité n'est pas un filtre mais une façon de lire le filtre
  // de plateforme : elle revient à son état ouvert avec lui.
  const reinitialiserFiltres = () => {
    for (const f of FILTRES) SETTEURS_FILTRE[f]("tous");
    setAvecRetro(true);
  };

  // Ajoute le jeu puis l'ouvre directement en fiche complète (parité fiche/ajout).
  //
  // Tous les filtres tombent, pas seulement ceux qui existaient quand cette
  // fonction a été écrite : un jeu ajouté depuis une liste filtrée par série
  // entrait bien dans la bibliothèque, mais sans série il n'y figurait pas, et
  // l'ajout ressemblait trait pour trait à une suppression.
  const addGame = (g) => {
    setGames(gs => [g, ...gs]);
    setShowAdd(false);
    setLastAddedId(g.id);
    setTab("library");
    setView("liste");
    reinitialiserFiltres();
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
    reinitialiserFiltres();
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
            if (d) setGames(gs => gs.map(x => x.id === ids[i] ? { ...x, cover: x.cover || d.background_image || null, metacritic: x.metacritic ?? d.metacritic ?? null, genre: x.genre?.length ? x.genre : normaliserGenres(d.genres?.map(z => z.name)) } : x));
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
    // L'index se lit dans `gamesRef`, tenue à jour à chaque rendu : le lire
    // depuis `games` obligeait à en dépendre, donc à refabriquer cette fonction
    // à chaque changement de la bibliothèque — et le memo() des fiches ne
    // servait plus à rien, puisqu'une de leurs props changeait à chaque frappe.
    const index = gamesRef.current.findIndex(x => x.id === g.id);
    setGames(gs => gs.filter(x => x.id !== g.id));
    setDeleted({ game: g, index });
    clearTimeout(undoRef.current);
    undoRef.current = setTimeout(() => setDeleted(null), 5000);
  }, []);
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
    // La sauvegarde ne portait que les jeux : un appareil neuf les retrouvait,
    // puis il fallait tout re-régler. Les clés n'y vont que si la case est
    // cochée sur cet appareil-ci.
    const prefs = preferencesASauvegarder({ modeTheme, keys, avecCles: sync.avecCles });
    const r = await envoyer(keys.proxy, sync.code, games, base, prefs);

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
    setSyncEtat({
      type: "ok",
      texte: `${games.length} jeu${games.length > 1 ? "x" : ""} sauvegardé${games.length > 1 ? "s" : ""}`
        + `${prefs.keys ? ", clés comprises" : ""}.`,
    });
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
    const { jeux, rejetes, corriges } = validerJeuxImportes(distants);
    const quand = r.data.updatedAt ? new Date(r.data.updatedAt).toLocaleString("fr-FR") : "date inconnue";

    // Un remplacement écrase du travail local : il se confirme, chiffres en main.
    const ok = window.confirm(
      `Sauvegarde du ${quand} : ${jeux.length} jeu(x).\n` +
      `Cet appareil en compte ${games.length}.` +
      (rejetes ? `\n\n⚠️ ${rejetes} entrée(s) ignorée(s).` : "") +
      (corriges ? `\n⚠️ ${corriges} entrée(s) corrigée(s).` : "") +
      `\n\nRemplacer la bibliothèque de cet appareil ?`
    );
    if (!ok) { setSyncEtat({ type: "ko", texte: "Récupération annulée." }); return; }
    setGames(jeux);

    // Les préférences se reprennent à part, et sur une seconde question : on
    // vient chercher une bibliothèque, pas forcément à se faire changer son
    // thème ni écraser ses clés par celles d'un autre appareil.
    const prefs = preferencesRecues(r.data.prefs);
    const resume = resumePreferences(prefs);
    if (resume && window.confirm(`La sauvegarde contient aussi ${resume}.\n\nLes appliquer à cet appareil ?`)) {
      if (prefs.modeTheme) setModeTheme(prefs.modeTheme);
      if (prefs.keys) {
        const fusion = { ...keys, ...prefs.keys };
        setKeys(fusion);
        setApiKeys(fusion);
      }
    }

    majSync({ ...sync, majLe: r.data.updatedAt || null });
    setSyncEtat({ type: "ok", texte: `${jeux.length} jeu${jeux.length > 1 ? "x" : ""} récupéré${jeux.length > 1 ? "s" : ""}.` });
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

      const { jeux, rejetes, corriges } = validerJeuxImportes(data);
      if (!jeux) { alert("Ce fichier ne contient pas une liste de jeux."); return; }
      if (!jeux.length) { alert(`Aucun jeu exploitable dans ce fichier${rejetes ? ` (${rejetes} entrée(s) ignorée(s))` : ""}.`); return; }

      // La question se posait dans un confirm() : « OK = REMPLACER, Annuler =
      // FUSIONNER ». Or Annuler veut dire « ne rien faire » partout ailleurs,
      // et Échap ferme sur Annuler — on croyait sortir de la boîte, on
      // déclenchait une fusion. Deux actions distinctes ne tiennent pas dans un
      // bouton binaire : elles ont chacune la leur, et annuler n'importe rien.
      setImportChoix({ jeux, rejetes, corriges });
    };
    reader.onerror = () => alert("Lecture du fichier impossible.");
    reader.readAsText(file);
    e.target.value = "";
  };

  const remplacerParImport = () => { setGames(importChoix.jeux); setImportChoix(null); };
  const fusionnerImport = () => {
    const ids = new Set(games.map(x => x.id));
    setGames(gs => [...gs, ...importChoix.jeux.filter(x => !ids.has(x.id))]);
    setImportChoix(null);
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
      const platMatch = jeuSurPlateforme(g, plat, avecRetro);
      const pretMatch = pretFil === "tous" ? true
        : pretFil === "prêtés" ? !!g.lentA
        : !g.lentA;
      return searchMatch
        && platMatch
        && (fmtFil === "tous" || g.format === fmtFil)
        // Le genre est une liste : un jeu retenu en porte au moins un.
        && (genreFil === "tous" || (g.genre || []).includes(genreFil))
        && jeuALeMode(g, modeFil)
        && jeuPasseSeuil(g, noteFil)
        && jeuACompleter(g, completFil)
        && (serieFil === "tous" || serieDuJeu(g) === serieFil)
        && pretMatch;
    });

    // Une clé triable par jeu, et `null` quand elle est inconnue. Ce qui n'a
    // pas de valeur va toujours à la fin, dans un sens comme dans l'autre :
    // inverser un tri ne doit pas remonter les jeux sans note en tête.
    const cle = (g) => {
      if (sort === "date") return g.addedDate || null;
      if (sort === "metacritic") return typeof g.metacritic === "number" ? g.metacritic : null;
      if (sort === "sortie") return dateDeSortie(g);
      return g.title || "";
    };
    // Le sens naturel de chaque tri : alphabétique pour les titres, du plus
    // récent et du mieux noté pour les autres — c'est ce qu'on veut voir en
    // premier sans avoir rien à régler.
    const compare = (a, b) => (sort === "titre"
      ? String(a).localeCompare(String(b))
      : (typeof a === "number" ? b - a : String(b).localeCompare(String(a))));

    if (sort === "aleatoire") {
      return list.sort((a, b) => empreinteMelange(a.id, graine) - empreinteMelange(b.id, graine));
    }
    return list.sort((a, b) => {
      const ka = cle(a), kb = cle(b);
      if (ka == null && kb == null) return 0;
      if (ka == null) return 1;
      if (kb == null) return -1;
      return compare(ka, kb) * sortDir;
    });
  }, [games, search, plat, avecRetro, pretFil, fmtFil, genreFil, modeFil, noteFil, completFil, serieFil,
    sort, sortDir, graine]);

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
  const filtresActifs = compterFiltres({ plat, pretFil, fmtFil, genreFil, modeFil, noteFil, completFil, serieFil });
  // Dérivés de TOUTE la bibliothèque, pas de la liste filtrée : sinon les
  // options disparaîtraient au fur et à mesure qu'on s'en sert.
  const genres = useMemo(() => genresPresents(games), [games]);
  const sansMode = useMemo(() => games.filter(g => !g.infobox?.modes?.length).length, [games]);
  const nbRetro = useMemo(() => compterRetro(games, plat), [games, plat]);
  const nbNatifs = useMemo(() => games.filter(g => g.platform === plat).length, [games, plat]);
  // Ce qui manque réellement : une option « Jaquette 0 » promettrait du travail
  // qui n'existe pas, et si tout est complet le groupe entier disparaît.
  const aCompleter = useMemo(() => completudeManquante(games), [games]);
  // Pas la somme des colonnes : un même jeu peut manquer de trois choses.
  const fichesIncompletes = useMemo(() => compterFichesIncompletes(games), [games]);

  // Regrouper ne change pas l'ordre : les sections apparaissent dans l'ordre
  // où le tri les fait apparaître, et un jeu ne bouge pas de place à
  // l'intérieur.
  //
  // La liste était paginée par trente, avec un bouton « Charger 30 de plus »
  // en pied de page. Mesure faite sur cent cinquante-cinq jeux, version
  // construite : tout monter d'un coup coûte deux dixièmes de seconde de plus
  // au démarrage sur une machine de bureau, sept sur un téléphone récent, une
  // seconde sur un ancien. Filtrer ensuite prend vingt millisecondes, et le
  // pire cas — effacer la recherche pour faire revenir les cent cinquante-cinq
  // — quatre cent quatre-vingts sur ce même vieux téléphone.
  //
  // Une seconde au démarrage contre un bouton en moins et la bibliothèque
  // entière visible : c'est le change qu'on a fait. Ce commentaire garde les
  // chiffres pour le jour où la bibliothèque aura doublé.
  const sections = useMemo(() => {
    if (groupePar === "aucun") return [{ titre: null, jeux: filtered }];
    const cle = (g) => (groupePar === "plateforme" ? g.platform
      : groupePar === "serie" ? (serieDuJeu(g) || "Sans série")
      : (g.genre?.[0] || "Sans genre"));
    const par = new Map();
    for (const g of filtered) {
      const k = cle(g) || "Sans réponse";
      if (!par.has(k)) par.set(k, []);
      par.get(k).push(g);
    }
    return [...par.entries()].map(([titre, jeux]) => ({ titre, jeux }));
  }, [filtered, groupePar]);

  // Les jeux d'une section, dans la vue demandée.
  //
  // La vue compacte n'ouvre pas les fiches : elle sert à parcourir vite, et
  // toucher une ligne bascule en liste sur ce jeu — exactement ce que fait déjà
  // une vignette de la grille. Deux façons de survoler, un seul endroit où lire.
  const rendreJeux = (liste) => {
    if (view === "grille") return (
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))", gap:10 }}>
        {liste.map(g => (
          <div key={g.id} className="gl-tile" style={{ background:card, border:`1px solid ${bdr}`, borderRadius: "var(--r-md)", overflow:"hidden", cursor:"pointer" }}
            onClick={() => { setView("liste"); setFocusId(g.id); }}>
            <Cover src={g.cover} title={g.title} size="100%" />
            <div style={{ height:3, background:g.lentA ? warnFond : "transparent" }} />
            <div style={{ padding:"6px 7px" }}>
              <div style={{ color:txt, fontSize: "var(--t-legende)", fontWeight:600, lineHeight:1.3, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{g.title}</div>
              {g.metacritic && <div style={{ color:g.metacritic>=80?ok:warn, fontSize: "var(--t-legende)", marginTop:2 }}>MC {g.metacritic}</div>}
            </div>
          </div>
        ))}
      </div>
    );
    if (view === "compact") return (
      <div style={{ background:card, border:`1px solid ${bdr}`, borderRadius:"var(--r-md)", overflow:"hidden" }}>
        {liste.map((g, i) => (
          <button key={g.id} className="gl-row" onClick={() => { setView("liste"); setFocusId(g.id); }}
            style={{
              display:"flex", alignItems:"center", gap:10, width:"100%", boxSizing:"border-box",
              minHeight:"var(--tap)", padding:"8px 12px", textAlign:"left", cursor:"pointer",
              background:"transparent", border:"none", borderTop: i ? `1px solid ${bdr}` : "none",
              fontFamily:"inherit",
            }}>
            <span style={{ width:8, height:8, borderRadius:"var(--r-xs)", flexShrink:0, background:PLATFORM_COLORS[g.platform] || accentFond }} />
            <span style={{ flex:1, minWidth:0, color:txt, fontSize:"var(--t-petit)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{g.title}</span>
            {g.lentA && <span style={{ color:warn, fontSize:"var(--t-legende)", flexShrink:0 }}>📤</span>}
            {g.metacritic && <span style={{ color:mut, fontSize:"var(--t-legende)", flexShrink:0 }}>{g.metacritic}</span>}
          </button>
        ))}
      </div>
    );
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {liste.map(g => <GameCard key={g.id} g={g} onEdit={edit} onDelete={deleteGame} onEnrich={enrichGame}
          onSerie={setSerieFil}
          autoOpen={g.id === lastAddedId || g.id === focusId} onOuverte={consommerOuverture} />)}
      </div>
    );
  };

  const emptyState = (
    <div style={{ textAlign: "center", padding: "70px 20px", color: mut }}>
      <div style={{ fontSize: 56, marginBottom: 12, opacity: 0.85 }}>🎮</div>
      <div style={{ color: txt, fontSize: "var(--t-titre)", fontWeight: 600, marginBottom: 6 }}>Aucun jeu trouvé</div>
      <div style={{ fontSize: "var(--t-petit)" }}>Essaie un autre terme ou change les filtres 🔍</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ background: hdr, borderBottom: `1px solid ${bdr}`, padding: "calc(12px + var(--safe-top)) calc(14px + var(--safe-right)) 12px calc(14px + var(--safe-left))", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "var(--t-legende)", color: ACCENT, lineHeight: 1.4, margin: 0, fontWeight: 400 }}>GAME LIBRARY</h1>
            {/* La ligne répond aux deux questions que l'application sert à poser :
                combien de jeux, et combien sont dehors. */}
            <div style={{ fontSize: "var(--t-legende)", color: mut, marginTop: 3 }}>
              {stats.total} jeu{stats.total > 1 ? "x" : ""}
              {/* Le nombre affiché ne se dit que s'il diffère du total : il
                  vivait sur une rangée à lui sous l'en-tête, que le tri a
                  libérée en remontant à côté de la recherche. */}
              {tab === "library" && filtered.length < games.length ? ` · ${filtered.length} affiché${filtered.length > 1 ? "s" : ""}` : ""}
              {stats.pretes > 0 ? ` · ${stats.pretes} prêté${stats.pretes > 1 ? "s" : ""}` : ""}
              {stats.enRetard > 0 ? <span style={{ color: warn }}> · {stats.enRetard} en retard</span> : null}
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
              style={{ ...btnHdr, background: accentFond, border: "none", color: "#fff", fontSize: "var(--t-corps)", fontWeight: 600 }}>
              + Ajouter
            </button>
          </div>
        </div>

        {alerteStockage && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: dangerDoux, border: `1px solid ${danger}`, borderRadius: "var(--r-sm)", padding: "8px 10px", marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0, color: danger, fontSize: "var(--t-legende)", fontWeight: 600, lineHeight: 1.4 }}>⚠️ {alerteStockage}</div>
            <button onClick={() => setAlerteStockage(null)} aria-label="Masquer" style={{ ...btnFermer, color: danger }}>✕</button>
          </div>
        )}

        {scoresEnCours && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: card, border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", padding: "8px 10px", marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0, color: txt, fontSize: "var(--t-legende)", fontWeight: 600 }}>Recherche des notes… {scoresProg}/{scoresTotal}</div>
            <button onClick={annulerScores} style={{ background: dangerDoux, border: `1px solid ${danger}`, color: danger, borderRadius: "var(--r-xs)", padding: "3px 8px", fontSize: "var(--t-legende)", cursor: "pointer" }}>Arrêter</button>
          </div>
        )}

        {scoresBilan?.message && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: card, border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", padding: "8px 10px", marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0, color: txt, fontSize: "var(--t-legende)", fontWeight: 600 }}>{scoresBilan.message}</div>
            <button onClick={() => setScoresBilan(null)} aria-label="Masquer" style={{ ...btnFermer, color: mut }}>✕</button>
          </div>
        )}

        {refreshMsg && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: card, border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", padding: "8px 10px", marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: txt, fontSize: "var(--t-legende)", fontWeight: 600 }}>{refreshMsg.text}</div>
              {refreshMsg.notFound.length > 0 && <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 3, maxHeight: 54, overflowY: "auto" }}>Sans page : {refreshMsg.notFound.join(", ")}</div>}
            </div>
            <button onClick={() => setRefreshMsg(null)} aria-label="Masquer" style={{ ...btnFermer, color: mut }}>✕</button>
          </div>
        )}

        {(importedIds.length > 0 || enriching) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: card, border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", padding: "8px 10px", marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0, color: txt, fontSize: "var(--t-legende)", fontWeight: 600 }}>
              {enriching ? `Enrichissement… ${enrichProg}/${importedIds.length}` : `${importedIds.length} jeu(x) importé(s) — enrichir via RAWG + Wikipédia ?`}
            </div>
            {enriching
              ? <button onClick={cancelEnrich} style={{ background: dangerDoux, border: `1px solid ${danger}`, color: danger, borderRadius: "var(--r-xs)", padding: "3px 8px", fontSize: "var(--t-legende)", cursor: "pointer" }}>Arrêter</button>
              : <>
                  <button onClick={enrichImported} style={{ background: accentDoux, border: `1px solid ${accent}`, color: accent, borderRadius: "var(--r-xs)", padding: "3px 8px", fontSize: "var(--t-legende)", cursor: "pointer" }}>Enrichir</button>
                  <button onClick={() => setImportedIds([])} aria-label="Masquer" style={{ ...btnFermer, color: mut }}>✕</button>
                </>}
          </div>
        )}

        {/* Onglets : pleine largeur, à la hauteur de cible tactile. */}
        <div style={{ display: "flex", gap: "var(--ecart-tap)", marginBottom: tab === "library" ? 10 : 0 }}>
          {/* « Bibliothèque » se coupait en « Bibliothè… » dès qu'il devenait l'onglet
              actif : le gras l'élargit, et quatre onglets ne tiennent pas dans
              360 px. Un libellé tronqué sur l'onglet principal donne l'air d'un
              écran cassé — « Jeux » dit la même chose et tient partout. */}
          {[["library","Jeux"],["loans",`Prêts${lentGames.length ? ` (${lentGames.length})` : ""}`],["stats","Stats"],["settings","⚙️"]].map(([k,l]) => (
            // Le dernier onglet n'a qu'un émoji pour libellé : un lecteur
            // d'écran annonçait « engrenage », ce qui ne dit pas où l'on va.
            <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
              aria-label={k === "settings" ? "Réglages" : undefined}
              style={{
                flex: k === "settings" ? "0 0 auto" : 1, minWidth: k === "settings" ? "var(--tap)" : 0,
                minHeight: "var(--tap)", background: tab===k ? accentFond : "transparent",
                border: `1px solid ${tab===k ? accentFond : bdr}`, color: tab===k ? "#fff" : mut,
                borderRadius: "var(--r-md)", padding: "0 8px", fontSize: "var(--t-petit)", fontWeight: tab===k ? 600 : 400,
                cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{l}</button>
          ))}
        </div>

        {/* Recherche, tri et accès aux filtres sur une seule ligne. Les quatre
            rangées de puces qui occupaient cette place sont dans le panneau
            « Filtres » ; le badge dit combien sont appliquées sans avoir à
            l'ouvrir.

            Quatre commandes tiennent sur 360 px à deux conditions : le champ
            abrège son invite — « Rechercher… » plutôt que la liste de ce qu'on
            peut y chercher, que la recherche elle-même montre dès la première
            lettre — et le bouton de tri ne porte son libellé que lorsqu'il
            n'est plus celui par défaut.

            Ce libellé coûte trente-quatre pixels, tous pris au champ, qui
            tombe alors à 88 px et affiche « Reche » : l'invite d'un champ ne
            s'abrège pas, elle se coupe net. Il ne reste alors qu'une loupe,
            qui se lit entière. Le nom accessible, lui, ne dépend plus de
            l'invite — sinon un lecteur d'écran annoncerait l'émoji. */}
        {tab === "library" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)} type="search"
              aria-label="Rechercher" placeholder={sort === TRI_DEFAUT ? "Rechercher…" : "🔍"}
              style={{ flex: 1, minWidth: 0, minHeight: "var(--tap)", background: card, border: `1px solid ${bdr}`, borderRadius: "var(--r-md)", color: txt, padding: "0 12px", fontSize: "var(--t-corps)" }} />
            {/* Le contour accentué est réservé à « Filtres ». Un tri choisi se
                dit par son libellé et par la couleur du texte, pas par une
                bordure : deux boutons au même traitement, côte à côte et sans
                la même importance, se confondent — et le bouton qui doit
                ressortir ne ressort plus. */}
            <button onClick={() => setShowSort(true)}
              aria-label={`Trier : ${libelleTri(sort)}`} title={`Trier : ${libelleTri(sort)}`}
              style={{ ...btnHdr, padding: sort === TRI_DEFAUT ? 0 : "0 10px", color: sort === TRI_DEFAUT ? txt : ACCENT, fontSize: "var(--t-corps)" }}>
              ⇅{sort === TRI_DEFAUT ? "" : ` ${libelleTri(sort)}`}
            </button>
            {/* Le sens n'a pas de sens pour un tirage au hasard : le bouton
                disparaît plutôt que de rester là sans rien faire. */}
            {sort !== "aleatoire" && (
              <button onClick={() => setSortDir(d => -d)}
                aria-label={sortDir === 1 ? "Inverser l'ordre" : "Rétablir l'ordre"}
                title={sortDir === 1 ? "Inverser l'ordre" : "Rétablir l'ordre"}
                style={{ ...btnHdr, padding: 0, background: sortDir === -1 ? accentDoux : "transparent", color: sortDir === -1 ? ACCENT : txt, fontSize: "var(--t-corps)" }}>
                {sortDir === 1 ? "↓" : "↑"}
              </button>
            )}
            <button onClick={() => setShowFilters(true)}
              style={{ ...btnHdr, padding: "0 10px", borderColor: filtresActifs ? ACCENT : bdr, color: filtresActifs ? ACCENT : txt, fontSize: "var(--t-corps)" }}>
              Filtres{filtresActifs > 0 && <span style={{ background: accentFond, color: "#fff", borderRadius: "var(--r-sm)", padding: "1px 6px", fontSize: "var(--t-legende)", fontWeight: 700 }}>{filtresActifs}</span>}
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding:"14px calc(14px + var(--safe-right)) calc(60px + var(--safe-bottom)) calc(14px + var(--safe-left))" }}>
        {tab === "library" && (filtered.length === 0 ? emptyState : (
          <>
          {sections.map(({ titre, jeux }) => (
            <div key={titre || "tout"}>
              {/* L'en-tête ne s'affiche que si l'on regroupe : sans lui, une
                  seule section n'a pas de nom à porter. */}
              {titre && (
                <div style={{ display:"flex", alignItems:"baseline", gap:8, margin:"18px 0 8px" }}>
                  <span style={{ color:txt, fontSize:"var(--t-petit)", fontWeight:600 }}>{titre}</span>
                  <span style={{ color:mut, fontSize:"var(--t-legende)" }}>{jeux.length}</span>
                  <span style={{ flex:1, height:1, background:bdr }} />
                </div>
              )}
              {rendreJeux(jeux)}
            </div>
          ))}
          </>
        ))}

        {tab === "loans" && (
          <div>
            {lentGames.length === 0 ? <div style={{ textAlign:"center", color:mut, padding:"40px 0" }}>Aucun jeu prêté actuellement</div>
            : lentGames.map(g => {
              // joursDePret fait déjà ce calcul, et refuse au passage une date
              // illisible plutôt que d'afficher « NaNj ».
              const days = joursDePret(g);
              // Le seuil était réécrit ici en dur : la date de retour convenue
              // n'aurait rien changé pour cet onglet.
              const tard = pretEnRetard(g);
              return (
                <div key={g.id} style={{ background:card, border:`1px solid ${tard?danger:bdr}`, borderRadius: "var(--r-md)", padding:"12px", marginBottom:8, display:"flex", gap:10, alignItems:"center" }}>
                  <Cover src={g.cover} title={g.title} size={52} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:txt, fontWeight:600, fontSize: "var(--t-corps)" }}>{g.title}</div>
                    <div style={{ color:warn, fontSize: "var(--t-petit)" }}>📤 {g.lentA}</div>
                    {days!==null && (
                      <div style={{ color:tard?danger:mut, fontSize: "var(--t-legende)" }}>
                        {days}j
                        {g.lentRetourPrevu
                          ? ` · à rendre le ${new Date(g.lentRetourPrevu).toLocaleDateString("fr-FR")}`
                          : ""}
                        {tard ? " ⚠️" : ""}
                      </div>
                    )}
                  </div>
                  <a href={`sms:?body=${encodeURIComponent(`Salut ! Tu penses à me rendre ${g.title} ? 😊`)}`} style={{ display:"inline-flex", alignItems:"center", minHeight:"var(--tap-min)", background:warnDoux, border:`1px solid ${warn}`, color:warn, borderRadius: "var(--r-sm)", padding:"0 12px", fontSize: "var(--t-legende)", textDecoration:"none", flexShrink:0 }}>SMS</a>
                </div>
              );
            })}

            {/* Les retours effaçaient toute trace du prêt. L'onglet ne montrait
                donc jamais que la moitié vivante d'un sujet qui a une suite. */}
            {historique.length > 0 && (
              <>
                <div style={{ color:txt, fontSize: "var(--t-petit)", fontWeight:600, margin:"18px 0 8px" }}>Déjà rendus</div>
                {historique.map((e, i) => (
                  <div key={i} style={{ display:"flex", gap:10, alignItems:"baseline", padding:"8px 2px", borderTop:`1px solid ${bdr}` }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:txt, fontSize: "var(--t-petit)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.titre}</div>
                      <div style={{ color:mut, fontSize: "var(--t-legende)" }}>{e.a} · rendu le {new Date(e.au).toLocaleDateString("fr-FR")}</div>
                    </div>
                    <span style={{ color:mut, fontSize: "var(--t-legende)", flexShrink:0 }}>{dureeEntreeHistorique(e)} j</span>
                    <button onClick={() => supprimerPretPasse(e.jeuId, e.index, e)}
                      aria-label={`Supprimer le prêt de ${e.titre} à ${e.a}`} title="Supprimer de l'historique"
                      style={{ ...btnFermer, color:mut }}>✕</button>
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

      {importChoix && (
        <Sheet title="Importer ce fichier" onClose={() => setImportChoix(null)}>
          <div style={{ color: txt, fontSize: "var(--t-corps)", lineHeight: 1.6, marginBottom: 4 }}>
            {importChoix.jeux.length} jeu{importChoix.jeux.length > 1 ? "x" : ""} valide{importChoix.jeux.length > 1 ? "s" : ""} dans le fichier.
            Cet appareil en compte {games.length}.
          </div>
          {/* Une valeur ramenée à une valeur sûre — date illisible, plateforme
              inconnue, note en toutes lettres — se dit : sans ça, un fichier
              abîmé s'importe comme un fichier sain, et la correction ne se
              remarque que plus tard, sur une fiche qui a changé toute seule. */}
          {(importChoix.rejetes > 0 || importChoix.corriges > 0) && (
            <div style={{ color: warn, fontSize: "var(--t-petit)", lineHeight: 1.5, marginBottom: 4 }}>
              {importChoix.rejetes > 0 && <div>⚠️ {importChoix.rejetes} entrée(s) sans titre ont été ignorées.</div>}
              {importChoix.corriges > 0 && <div>⚠️ {importChoix.corriges} entrée(s) contenaient des valeurs illisibles, ramenées à des valeurs sûres.</div>}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            <button onClick={fusionnerImport}
              style={{ minHeight: "var(--tap)", background: accentFond, border: "1px solid transparent", color: "#fff", borderRadius: "var(--r-sm)", fontSize: "var(--t-corps)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left", padding: "0 14px" }}>
              Fusionner — ajoute seulement les jeux absents
            </button>
            <button onClick={remplacerParImport}
              style={{ minHeight: "var(--tap)", background: "transparent", border: `1px solid ${danger}`, color: danger, borderRadius: "var(--r-sm)", fontSize: "var(--t-corps)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left", padding: "0 14px" }}>
              Remplacer — jette les {games.length} jeu{games.length > 1 ? "x" : ""} de cet appareil
            </button>
            <button onClick={() => setImportChoix(null)}
              style={{ minHeight: "var(--tap)", background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: "var(--r-sm)", fontSize: "var(--t-corps)", cursor: "pointer", fontFamily: "inherit" }}>
              Annuler
            </button>
          </div>
        </Sheet>
      )}

      {showAdd && <AddModal onAdd={addGame} onClose={() => setShowAdd(false)} />}
      {showImport && <ImportModal games={games} onImportGames={importGames} onClose={() => setShowImport(false)} />}
      {showFilters && (
        <FiltersSheet
          plat={plat} setPlat={setPlat}
          avecRetro={avecRetro} setAvecRetro={setAvecRetro} nbRetro={nbRetro} nbNatifs={nbNatifs}
          pretFil={pretFil} setPretFil={setPretFil}
          fmtFil={fmtFil} setFmtFil={setFmtFil}
          genreFil={genreFil} setGenreFil={setGenreFil}
          modeFil={modeFil} setModeFil={setModeFil}
          genres={genres} sansMode={sansMode}
          noteFil={noteFil} setNoteFil={setNoteFil}
          completFil={completFil} setCompletFil={setCompletFil} aCompleter={aCompleter}
          fichesIncompletes={fichesIncompletes}
          serieFil={serieFil} setSerieFil={setSerieFil}
          groupePar={groupePar} setGroupePar={setGroupePar}
          view={view} setView={setView}
          resultats={filtered.length}
          onReinitialiser={reinitialiserFiltres}
          onClose={() => setShowFilters(false)}
        />
      )}
      {showSort && (
        <SortSheet sort={sort} setSort={setSort}
          onMelanger={() => setGraine(g => (g + 1 + Math.floor(Math.random() * 9999)) % 100000)}
          onClose={() => setShowSort(false)} />
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
          onPartager={partagerListe}
          partageTotal={filtered.length}
          partageFiltre={filtered.length < games.length}
        />
      )}

      {scoresBilan && (scoresBilan.message
        ? null
        : <ScoresSheet bilan={scoresBilan} onAnnulerScore={retirerScore} onClose={() => setScoresBilan(null)} />)}

      {majDispo && (
        <div role="status" style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)", width:"max-content", zIndex:401, display:"flex", alignItems:"center", gap:10, maxWidth:"calc(100vw - 24px)", background:card, border:`1px solid ${accent}`, borderRadius: "var(--r-md)", padding:"10px 14px", boxShadow:"0 8px 24px rgba(0,0,0,0.4)", animation:"toastIn 200ms ease" }}>
          {/* Sur 412 px, les trois éléments ne tiennent que si le libellé ne
              se casse pas : « installée » partait à la ligne, seul. */}
          <span style={{ color:txt, fontSize: "var(--t-corps)", whiteSpace:"nowrap" }}>✨ Nouvelle version</span>
          <button onClick={() => location.reload()} style={{ background:accentDoux, border:`1px solid ${accent}`, color:accent, borderRadius: "var(--r-sm)", padding:"4px 12px", fontSize: "var(--t-petit)", fontWeight:600, cursor:"pointer" }}>Recharger</button>
          <button onClick={() => setMajDispo(false)} aria-label="Plus tard" style={{ ...btnFermer, color:mut }}>✕</button>
        </div>
      )}

      {/* `width: max-content` sur les trois bandeaux : posés à `left: 50%`, ils
          n'avaient pour largeur disponible que la moitié droite de l'écran, et
          repliaient leur texte sur trois lignes bien avant d'atteindre le bord.
          Invisible tant que le texte était court — « supprimé » précédé d'un
          titre à rallonge le montrait déjà. */}
      {partageEtat && (
        <div role="status" style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)", width:"max-content", zIndex:400, display:"flex", alignItems:"center", gap:14, maxWidth:"calc(100vw - 24px)", background:card, border:`1px solid ${bdr}`, borderRadius: "var(--r-md)", padding:"10px 14px", boxShadow:"0 8px 24px rgba(0,0,0,0.4)", animation:"toastIn 200ms ease" }}>
          <span style={{ color:txt, fontSize: "var(--t-corps)" }}>{partageEtat}</span>
          <button onClick={() => setPartageEtat(null)} aria-label="Masquer"
            style={{ background:"transparent", border:`1px solid ${bdr}`, color:mut, borderRadius: "var(--r-sm)", padding:"4px 12px", fontSize: "var(--t-petit)", cursor:"pointer" }}>OK</button>
        </div>
      )}

      {deleted && (
        <div role="status" style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)", width:"max-content", zIndex:400, display:"flex", alignItems:"center", gap:14, background:card, border:`1px solid ${bdr}`, borderRadius: "var(--r-md)", padding:"10px 14px", boxShadow:"0 8px 24px rgba(0,0,0,0.4)", animation:"toastIn 200ms ease" }}>
          <span style={{ color:txt, fontSize: "var(--t-corps)" }}>🗑 « {deleted.game.title} » supprimé</span>
          <button onClick={undoDelete} style={{ background:"transparent", border:`1px solid ${accent}`, color:accent, borderRadius: "var(--r-sm)", padding:"4px 12px", fontSize: "var(--t-petit)", fontWeight:600, cursor:"pointer" }}>Annuler</button>
        </div>
      )}
    </div>
  );
}

