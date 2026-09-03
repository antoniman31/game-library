import { useState, useMemo, useEffect, useRef } from "react";

import Cover from "./components/Cover.jsx";
import GameCard from "./components/GameCard.jsx";
import AddModal from "./components/AddModal.jsx";
import ImportModal from "./components/ImportModal.jsx";

import { hdr, card, bdr, txt, mut } from "./lib/theme.js";
import { GAMES_INIT } from "./lib/seed.js";
import {
  STATUTS, STATUS_COLORS, PLATFORMS, BACK_COMPAT,
  migrateGames, fmtTime, staleKey,
} from "./lib/model.js";
import {
  loadKeys, setApiKeys, normTitle, hasRawgKey, rawgFirstResult,
  rawgSearch, rawgDetail, wikiFrenchTitles, wikiArticleData, pickBestWikiTitle,
  sgdbSearch, xblTitleHistory,
} from "./lib/api.js";

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
      if (!hasRawgKey()) return;   // pas de clé RAWG configurée -> on ne tente rien
      const missing = games.filter(g => !g.cover);
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
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))", gap:10 }}>
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

