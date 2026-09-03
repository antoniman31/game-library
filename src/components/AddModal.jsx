import { useState, useRef } from "react";
import { bg, card, bdr, txt, mut } from "../lib/theme.js";
import { PLATFORMS, STATUTS, isBackCompatPlatform } from "../lib/model.js";
import {
  rawgSearch, rawgDetail, wikiFrenchTitles, wikiArticleData, wikidataInfobox,
  sgdbSearch, sgdbGrids,
} from "../lib/api.js";

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


export default AddModal;
