import { useState, useRef } from "react";
import Sheet from "./Sheet.jsx";
import { bg, card, bdr, txt, mut, accent, accentFond } from "../lib/theme.js";
import { PC, PLATFORMES_JEU, isBackCompatPlatform, normaliserGenres } from "../lib/model.js";
import {
  rawgSearch, rawgDetail, wikiFrenchTitles, wikiArticleData, wikidataInfobox,
  sgdbSearch, sgdbGrids,
} from "../lib/api.js";

function AddModal({ onAdd, onClose }) {
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("Xbox Series X");
  const [fmt, setFmt] = useState("physique");
  const [boutique, setBoutique] = useState("");
  const [date, setDate] = useState("");
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

  const inp = { background: bg, border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", color: txt, minHeight: "var(--tap-min)", padding: "8px 12px", fontSize: "var(--t-corps)", width: "100%", boxSizing: "border-box", fontFamily: "inherit" };
  // Les boutons de source faisaient 26 px de haut, sous le plancher de 44 :
  // ils sont plus anciens que les règles d'ergonomie du projet, et cette
  // fenêtre est le seul endroit qui ne les avait jamais reçues.
  const srcBtn = { background: "transparent", border: `1px solid ${accent}`, color: accent, borderRadius: "var(--r-sm)", minHeight: "var(--tap-min)", padding: "0 12px", fontSize: "var(--t-legende)", cursor: "pointer", fontFamily: "inherit" };

  // Un libellé au-dessus de chaque champ, et pas seulement une invite : une
  // invite disparaît dès la première lettre tapée, et sur un menu déroulant ou
  // un champ de date il n'y en a même pas — rien ne disait ce qu'on choisissait.
  const Ligne = ({ label, aide, children }) => (
    <label style={{ display: "block", marginBottom: 10 }}>
      <span style={{ display: "block", color: mut, fontSize: "var(--t-legende)", marginBottom: 4 }}>
        {label}{aide ? <span style={{ opacity: 0.75 }}> · {aide}</span> : null}
      </span>
      {children}
    </label>
  );

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
      id: Date.now(), title: title.trim(), platform,
      format: platform === PC ? "démat" : fmt,
      boutique: platform === PC ? boutique.trim() : "",
      addedDate: date || new Date().toISOString().slice(0, 10),
      genre: normaliserGenres(rawg?.genres?.map(g => g.name)),
      style: wikiExtract || "",
      lentA: null, lentDate: null,
      cover: cover || rawg?.background_image || null,
      metacritic: rawg?.metacritic || null,
      myLinks: ["","",""], tips: "", tag: "",
      backCompat: isBackCompatPlatform(platform), infobox: wikiInfo || null,
    });
  };

  // Cette fenêtre réimplémentait mot pour mot le panneau glissant de Sheet :
  // même position, même fond, même repli — mais sans poignée ni bouton de
  // fermeture, et à corriger deux fois.
  return (
    <Sheet title="Ajouter un jeu" onClose={onClose}>

        <div style={{ position: "relative", marginBottom: 10 }}>
          <Ligne label="Titre" aide="obligatoire">
          <input value={title} onChange={e => { setTitle(e.target.value); clearTimeout(debRef.current); debRef.current = setTimeout(() => search(e.target.value), 350); }} placeholder="Titre du jeu" style={inp} />
          </Ligne>
          {loading && <div style={{ color: accent, fontSize: "var(--t-legende)", marginTop: 3 }}>Recherche RAWG…</div>}
          {sugg.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: card, border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", zIndex: 10, overflow: "hidden", boxShadow: "0 8px 24px #0008" }}>
              {sugg.map(s => (
                <div key={s.id} className="gl-row" onClick={() => pick(s)} style={{ display: "flex", gap: 8, padding: "8px 10px", cursor: "pointer", borderBottom: `1px solid ${bdr}` }}>
                  {s.background_image && <img src={s.background_image} alt="" style={{ width: 34, height: 51, minWidth: 34, objectFit: "cover", borderRadius: "var(--r-xs)" }} />}
                  <div><div style={{ color: txt, fontSize: "var(--t-petit)", fontWeight: 600 }}>{s.name}</div><div style={{ color: mut, fontSize: "var(--t-legende)" }}>{s.released}{s.metacritic ? ` · MC ${s.metacritic}` : ""}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Récap des sources choisies */}
        {(cover || rawg || wikiExtract) && (
          <div style={{ background: card, borderRadius: "var(--r-sm)", padding: "8px 10px", marginBottom: 10, display: "flex", gap: 10 }}>
            {cover && <img src={cover} alt="Jaquette sélectionnée" style={{ width: 40, height: 60, minWidth: 40, objectFit: "cover", borderRadius: "var(--r-sm)" }} />}
            <div style={{ minWidth: 0 }}>
              {rawg && <div style={{ color: mut, fontSize: "var(--t-legende)" }}>{rawg.genres?.map(g => g.name).join(", ")}{rawg.metacritic ? ` · MC ${rawg.metacritic}` : ""}</div>}
              {wikiExtract && <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 2, maxHeight: 40, overflow: "hidden" }}>📝 {wikiExtract.slice(0, 90)}…</div>}
              {!wikiExtract && !rawg && cover && <div style={{ color: mut, fontSize: "var(--t-legende)" }}>Jaquette sélectionnée</div>}
            </div>
          </div>
        )}

        {/* Sources : Wikipédia + SteamGridDB */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <button onClick={() => { setWikiOpen(o => !o); if (!wikiOpen && title.trim()) { setWikiDone(false); wikiQuery(title); } }} style={srcBtn}>🇫🇷 Wikipédia (titre + desc.)</button>
          <button onClick={() => { setSgOpen(o => !o); if (!sgOpen && title.trim()) { setSgDone(false); sgQuery(title); } }} style={srcBtn}>📦 Jaquette SteamGridDB</button>
        </div>

        {wikiOpen && (
          <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", padding: "10px 12px", marginBottom: 10 }}>
            <div style={{ color: txt, fontSize: "var(--t-legende)", fontWeight: 600, marginBottom: 6 }}>Titre + description (Wikipédia)</div>
            <input defaultValue={title} onChange={e => wikiQuery(e.target.value)} placeholder="Titre du jeu…" style={{ ...inp, fontSize: "var(--t-petit)", padding: "6px 8px" }} />
            {wikiBusy && <div style={{ color: accent, fontSize: "var(--t-legende)", marginTop: 4 }}>Recherche…</div>}
            {!wikiBusy && wikiSugg.length > 0 && (
              <div style={{ marginTop: 6, background: bg, border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", maxHeight: 260, overflowY: "auto" }}>
                {wikiSugg.map((s, i) => (
                  <div key={i} className="gl-row" style={{ display: "flex", gap: 8, padding: "7px 9px", borderBottom: `1px solid ${bdr}`, alignItems: "center" }}>
                    <div onClick={() => wikiPick(s.title)} style={{ flex: 1, minWidth: 0, cursor: "pointer", color: txt, fontSize: "var(--t-petit)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                    {s.url && <a href={s.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: accent, fontSize: "var(--t-legende)", textDecoration: "none", flexShrink: 0 }}>↗</a>}
                  </div>
                ))}
              </div>
            )}
            {!wikiBusy && wikiDone && wikiSugg.length === 0 && <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 6 }}>Aucun résultat Wikipédia</div>}
          </div>
        )}

        {sgOpen && (
          <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", padding: "10px 12px", marginBottom: 10 }}>
            <div style={{ color: txt, fontSize: "var(--t-legende)", fontWeight: 600, marginBottom: 6 }}>Jaquette SteamGridDB</div>
            <input defaultValue={title} onChange={e => sgQuery(e.target.value)} placeholder="Titre du jeu…" style={{ ...inp, fontSize: "var(--t-petit)", padding: "6px 8px" }} />
            {sgBusy && <div style={{ color: accent, fontSize: "var(--t-legende)", marginTop: 6 }}>Recherche des jaquettes…</div>}
            {!sgBusy && sgGrids.length > 0 && (
              <>
                {sgMatch && <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 6 }}>Trouvé : <span style={{ color: txt, fontWeight: 600 }}>{sgMatch}</span></div>}
                <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, maxHeight: 300, overflowY: "auto" }}>
                  {sgGrids.map((grid, i) => (
                    <img key={i} src={grid.thumb} alt="" loading="lazy" onClick={() => { setCover(grid.url); setSgOpen(false); }} title="Choisir cette jaquette"
                      style={{ width: "100%", aspectRatio: "2 / 3", objectFit: "cover", borderRadius: "var(--r-sm)", border: cover === grid.url ? `2px solid ${accent}` : `1px solid ${bdr}`, cursor: "pointer", display: "block" }} />
                  ))}
                </div>
              </>
            )}
            {!sgBusy && sgDone && sgGrids.length === 0 && <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 6 }}>Aucune jaquette trouvée sur SteamGridDB</div>}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <Ligne label="Plateforme">
            <select value={platform} onChange={e => setPlatform(e.target.value)} style={inp}>{PLATFORMES_JEU.map(p => <option key={p}>{p}</option>)}</select>
          </Ligne>
          {/* Un jeu PC est toujours démat : ce qui le distingue est la
              boutique, et elle prend la place du format. */}
          {platform === PC
            ? (
              <Ligne label="Boutique">
                <input value={boutique} onChange={e => setBoutique(e.target.value)}
                  placeholder="Steam, Epic, GOG…" style={inp} />
              </Ligne>
            ) : (
              <Ligne label="Format">
                <select value={fmt} onChange={e => setFmt(e.target.value)} style={inp}><option>physique</option><option>démat</option></select>
              </Ligne>
            )}
        </div>
        <Ligne label="Ajouté le">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
        </Ligne>

        {/* 40 px de haut : sous le plancher de 44, et pour les deux boutons qui
            terminent le geste. `padding: 10` fixait la hauteur à la taille du
            texte au lieu de la poser. */}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, minHeight: "var(--tap)", background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: "var(--r-sm)", padding: "0 12px", cursor: "pointer", fontSize: "var(--t-corps)", fontFamily: "inherit" }}>Annuler</button>
          <button onClick={handleAdd} style={{ flex: 2, minHeight: "var(--tap)", background: accentFond, border: "none", color: "#fff", borderRadius: "var(--r-sm)", padding: "0 12px", cursor: "pointer", fontSize: "var(--t-corps)", fontWeight: 600, fontFamily: "inherit" }}>Ajouter</button>
        </div>
    </Sheet>
  );
}


export default AddModal;
