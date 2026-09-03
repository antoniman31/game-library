import { useState, useEffect, useRef } from "react";
import Cover from "./Cover.jsx";
import InfoboxView from "./InfoboxView.jsx";
import { bg, card, bdr, txt, mut, demat } from "../lib/theme.js";
import {
  STATUTS, STATUS_COLORS, PLATFORM_COLORS, BACK_COMPAT_PARENT,
  fmtTime, isDusty, lastSessionDate, daysSince,
} from "../lib/model.js";
import {
  rawgSearch, rawgDetail, wikiFrenchTitles, wikiArticleData, wikidataInfobox,
  sgdbSearch, sgdbGrids,
} from "../lib/api.js";

function GameCard({ g, onEdit, onDelete, onEnrich, activeTimer, timerStart, onStartTimer, onStopTimer, autoOpen, compact = false }) {
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
  const isActive = activeTimer === g.id;
  const [section, setSection] = useState(null);
  const toggle = s => setSection(c => c === s ? null : s);

  // Le début de la session vient de l'état global, pas d'une référence posée à
  // l'activation : après un rechargement, le chrono restauré repartait
  // visuellement de 00:00 alors que le temps réellement comptabilisé, lui,
  // partait du vrai début. Deux vérités pour la même session.
  useEffect(() => {
    if (!isActive) return;
    const t = setInterval(() => setTick(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [isActive]);

  const elapsed = isActive && timerStart ? Math.floor((Date.now() - timerStart) / 1000) : 0;
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

      <div style={{ display: "flex", gap: compact ? 8 : 10, padding: compact ? "8px 10px" : 12, cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <Cover src={g.cover} title={g.title} size={compact ? 46 : 72} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ background: PLATFORM_COLORS[g.platform] || "#5493FF", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 3, padding: "1px 5px" }}>{g.platform}</span>
            <span key={g.status} style={{ border: `1px solid ${STATUS_COLORS[g.status]}`, color: STATUS_COLORS[g.status], fontSize: 9, borderRadius: 3, padding: "1px 5px", display: "inline-block", animation: "statusPop 200ms ease" }}>{g.status}</span>
            {g.format === "démat" && <span style={{ background: demat, color: "#5493FF", fontSize: 9, borderRadius: 3, padding: "1px 5px" }}>démat</span>}
            {BACK_COMPAT_PARENT[g.platform] && g.backCompat && <span title={`Rétrocompatible ${BACK_COMPAT_PARENT[g.platform]}`} style={{ background: "#107C1022", color: "#22c55e", fontSize: 9, borderRadius: 3, padding: "1px 5px" }}>🔄 Compatible {BACK_COMPAT_PARENT[g.platform].replace("Xbox ", "")}</span>}
            {g.lentA && <span style={{ background: "#7c320044", color: "#f59e0b", fontSize: 9, borderRadius: 3, padding: "1px 5px" }}>📤 {g.lentA}</span>}
            {isActive && <span style={{ background: "#22c55e22", color: "#22c55e", fontSize: 9, borderRadius: 3, padding: "1px 5px" }}>▶ {String(Math.floor(elapsed/60)).padStart(2,"0")}:{String(elapsed%60).padStart(2,"0")}</span>}
          </div>
          <div style={{ fontWeight: 600, fontSize: 13, color: txt, marginBottom: 3, ...(compact ? { overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" } : {}) }}>{g.title}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {g.metacritic && <span style={{ color: g.metacritic >= 80 ? "#22c55e" : g.metacritic >= 60 ? "#f59e0b" : "#ef4444", fontSize: 11, fontWeight: 700 }}>MC {g.metacritic}</span>}
            {total > 0 && <span style={{ color: mut, fontSize: 11 }}>{fmtTime(total)}</span>}
            {hltbPct !== null && <span style={{ color: hltbPct >= 100 ? "#22c55e" : "#5493FF", fontSize: 11 }}>{hltbPct}% HLtB</span>}
            {!compact && idleDays !== null && <span style={{ color: idleDays > 30 ? "#f59e0b" : mut, fontSize: 11 }}>💤 {idleDays}j depuis dernière session</span>}
          </div>
          {!compact && hltbPct !== null && <div style={{ marginTop: 4, height: 3, background: bdr, borderRadius: 2 }}><div style={{ width: `${Math.min(100, hltbPct)}%`, height: "100%", background: hltbPct >= 100 ? "#22c55e" : "#5493FF", borderRadius: 2 }} /></div>}
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
            {STATUTS.map(s => <button key={s} onClick={() => onEdit(g.id, "status", s)} style={{ background: g.status === s ? STATUS_COLORS[s] + "33" : "transparent", border: `1px solid ${g.status === s ? STATUS_COLORS[s] : bdr}`, color: g.status === s ? STATUS_COLORS[s] : mut, borderRadius: 6, padding: "0 10px", minHeight: 36, fontSize: 11, cursor: "pointer" }}>{s}</button>)}
          </div>

          {/* Format physique / démat */}
          <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 12 }}>
            <span style={{ color: mut, fontSize: 11 }}>Format :</span>
            {["physique", "démat"].map(f => <button key={f} onClick={() => onEdit(g.id, "format", f)} style={{ background: g.format === f ? "#5493FF22" : "transparent", border: `1px solid ${g.format === f ? "#5493FF" : bdr}`, color: g.format === f ? "#5493FF" : mut, borderRadius: 6, padding: "0 12px", minHeight: 36, fontSize: 11, cursor: "pointer" }}>{f}</button>)}
          </div>

          {/* Rétrocompatibilité : exception au cas par cas (jeux Xbox One / Switch 1) */}
          {BACK_COMPAT_PARENT[g.platform] && (
            <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ color: mut, fontSize: 11 }}>Jouable sur {BACK_COMPAT_PARENT[g.platform]} :</span>
              {[["oui", true], ["non", false]].map(([label, val]) => (
                <button key={label} onClick={() => onEdit(g.id, "backCompat", val)}
                  style={{ background: !!g.backCompat === val ? (val ? "#22c55e22" : "#ef444422") : "transparent", border: `1px solid ${!!g.backCompat === val ? (val ? "#22c55e" : "#ef4444") : bdr}`, color: !!g.backCompat === val ? (val ? "#22c55e" : "#ef4444") : mut, borderRadius: 6, padding: "0 12px", minHeight: 36, fontSize: 11, cursor: "pointer" }}>{label}</button>
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
                    <button onClick={() => { onEdit(g.id, "style", wikiExtract); setWikiExtract(null); }} style={{ background: "#22c55e22", border: "1px solid #22c55e", color: "#22c55e", borderRadius: 6, padding: "0 10px", minHeight: 38, fontSize: 11, cursor: "pointer" }}>Utiliser ce résumé</button>
                    <button onClick={() => setWikiExtract(null)} style={{ background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: 6, padding: "0 10px", minHeight: 38, fontSize: 11, cursor: "pointer" }}>Garder la description actuelle</button>
                  </div>
                </div>
              )}

              {/* Jaquette Wikipédia */}
              {wikiImage && (
                <div style={{ marginTop: 10, borderTop: `1px solid ${bdr}`, paddingTop: 8 }}>
                  <div style={{ color: txt, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Jaquette Wikipédia</div>
                  <img src={wikiImage} alt="" style={{ maxWidth: 120, maxHeight: 160, objectFit: "contain", borderRadius: 6, border: `1px solid ${bdr}`, display: "block", marginBottom: 6 }} />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => { onEdit(g.id, "cover", wikiImage); setWikiImage(null); }} style={{ background: "#22c55e22", border: "1px solid #22c55e", color: "#22c55e", borderRadius: 6, padding: "0 10px", minHeight: 38, fontSize: 11, cursor: "pointer" }}>Utiliser cette jaquette</button>
                    <button onClick={() => setWikiImage(null)} style={{ background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: 6, padding: "0 10px", minHeight: 38, fontSize: 11, cursor: "pointer" }}>Garder la jaquette actuelle</button>
                  </div>
                </div>
              )}

              {/* Infos Wikidata */}
              {wikiInfo && (
                <div style={{ marginTop: 10, borderTop: `1px solid ${bdr}`, paddingTop: 8 }}>
                  <div style={{ color: txt, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>ℹ️ Infos (Wikidata)</div>
                  <div style={{ marginBottom: 6 }}><InfoboxView info={wikiInfo} /></div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => { onEdit(g.id, "infobox", wikiInfo); setWikiInfo(null); }} style={{ background: "#22c55e22", border: "1px solid #22c55e", color: "#22c55e", borderRadius: 6, padding: "0 10px", minHeight: 38, fontSize: 11, cursor: "pointer" }}>Utiliser ces infos</button>
                    <button onClick={() => setWikiInfo(null)} style={{ background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: 6, padding: "0 10px", minHeight: 38, fontSize: 11, cursor: "pointer" }}>Ignorer</button>
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
              <button onClick={() => { setRawgOpen(o => !o); if (!rawgOpen) { setRawgQ(g.title); rawgQuery(g.title); } }} style={{ background: "transparent", border: "1px solid #5493FF", color: "#5493FF", borderRadius: 6, padding: "0 10px", minHeight: 38, fontSize: 11, cursor: "pointer" }}>🔄 Rechercher sur RAWG</button>
              <button onClick={() => { setWikiOpen(o => !o); if (!wikiOpen) { setWikiQ(g.title); setWikiDone(false); wikiQuery(g.title); } }} style={{ background: "transparent", border: "1px solid #5493FF", color: "#5493FF", borderRadius: 6, padding: "0 10px", minHeight: 38, fontSize: 11, cursor: "pointer" }}>🇫🇷 Titre français</button>
              <button onClick={() => { setSgdbOpen(o => !o); if (!sgdbOpen) { setSgdbQ(g.title); setSgdbDone(false); sgdbQuery(g.title); } }} style={{ background: "transparent", border: "1px solid #5493FF", color: "#5493FF", borderRadius: 6, padding: "0 10px", minHeight: 38, fontSize: 11, cursor: "pointer" }}>📦 Jaquette SteamGridDB</button>
              <button onClick={() => onDelete(g)} style={{ background: "transparent", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 6, padding: "0 10px", minHeight: 38, fontSize: 11, cursor: "pointer" }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameCard;
