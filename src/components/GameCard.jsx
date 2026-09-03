import { memo, useState, useEffect, useRef } from "react";
import Cover from "./Cover.jsx";
import InfoboxView from "./InfoboxView.jsx";
import { bg, card, bdr, txt, mut, demat } from "../lib/theme.js";
import { PLATFORM_COLORS, BACK_COMPAT_PARENT, joursDePret, pretEnRetard } from "../lib/model.js";
import {
  rawgSearch, rawgDetail, wikiFrenchTitles, wikiArticleData, wikidataInfobox,
  sgdbSearch, sgdbGrids,
} from "../lib/api.js";

const boutonSource = { height: 36, padding: "0 12px", background: "transparent", border: "1px solid #5493FF", color: "#5493FF", borderRadius: 8, fontSize: 11, cursor: "pointer" };

function GameCard({ g, onEdit, onDelete, onEnrich, autoOpen }) {
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
  const [pretOuvert, setPretOuvert] = useState(false);
  const [sourcesOuvertes, setSourcesOuvertes] = useState(false);
  const [section, setSection] = useState(null);
  const toggle = s => setSection(c => c === s ? null : s);

  // Le traitement qui signalait les jeux délaissés — bordure en pointillés et
  // opacité réduite — sert désormais au seul signal qui reste : un prêt qui
  // s'éternise se repère dans la liste sans ouvrir l'onglet Prêts.
  const enRetard = pretEnRetard(g);
  const jours = joursDePret(g);
  const baseBorder = enRetard ? "#f59e0b" : bdr;
  const noteCouleur = g.metacritic >= 80 ? "#22c55e" : g.metacritic >= 60 ? "#f59e0b" : "#ef4444";

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
    // Un filet suffit à séparer : encadrer chaque section donnait six
    // rectangles de poids identique, et donc aucune hiérarchie.
    <div>
      <button onClick={() => toggle(id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", boxSizing: "border-box", background: "transparent", border: "none", borderTop: `1px solid ${bdr}`, padding: "13px 2px", color: txt, fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
        <span>{title}</span>
        <span style={{ color: mut }}>{section === id ? "▾" : "▸"}</span>
      </button>
      {section === id && <div style={{ padding: "0 2px 12px" }}>{content}</div>}
    </div>
  );

  return (
    <div ref={rootRef} className="gl-card" style={{ background: card, border: `1px ${enRetard ? "dashed" : "solid"} ${baseBorder}`, borderRadius: 12, overflow: "hidden", transition: "border-color 0.2s" }}>

      <div style={{ display: "flex", gap: 8, padding: "8px 10px", cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <Cover src={g.cover} title={g.title} size={46} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ background: PLATFORM_COLORS[g.platform] || "#5493FF", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 3, padding: "1px 5px" }}>{g.platform}</span>
            {g.format === "démat" && <span style={{ background: demat, color: "#5493FF", fontSize: 9, borderRadius: 3, padding: "1px 5px" }}>démat</span>}
            {BACK_COMPAT_PARENT[g.platform] && g.backCompat && <span title={`Rétrocompatible ${BACK_COMPAT_PARENT[g.platform]}`} style={{ background: "#107C1022", color: "#22c55e", fontSize: 9, borderRadius: 3, padding: "1px 5px" }}>🔄 Compatible {BACK_COMPAT_PARENT[g.platform].replace("Xbox ", "")}</span>}
            {g.lentA && <span key={g.lentA} style={{ background: "#7c320044", color: "#f59e0b", fontSize: 9, borderRadius: 3, padding: "1px 5px", animation: "statusPop 200ms ease" }}>📤 {g.lentA}{jours !== null ? ` · ${jours}j` : ""}</span>}
            {/* Rien d'autre ici : les badges disent l'exemplaire, pas le contenu. */}
          </div>
          <div style={{ fontWeight: 600, fontSize: 13, color: txt, marginBottom: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{g.title}</div>
          {/* Le titre laissait un grand vide à sa droite ; la note, le genre et
              la date d'ajout le remplissent, et la liste se lit sans déplier. */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", overflow: "hidden", whiteSpace: "nowrap", fontSize: 11, color: mut }}>
            {g.metacritic && <span style={{ color: noteCouleur, fontWeight: 700 }}>MC {g.metacritic}</span>}
            {g.genre[0] && <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{g.genre[0]}</span>}
            <span style={{ flexShrink: 0 }}>{new Date(g.addedDate).toLocaleDateString("fr-FR")}</span>
          </div>
        </div>
        <span style={{ color: mut, alignSelf: "center" }}>{open ? "▲" : "▼"}</span>
      </div>
      {/* La barre encodait le statut ; elle encode désormais le seul état suivi. */}
      <div style={{ height: 2, background: g.lentA ? "#f59e0b" : "transparent" }} />

      {open && (
        <div style={{ padding: "12px 14px", borderTop: `1px solid ${bdr}` }} onClick={e => e.stopPropagation()}>
          {/* Identité. La jaquette et les informations courtes en deux colonnes,
              la description en pleine largeur dessous.
              Le texte habillait auparavant la jaquette : ses dernières lignes
              repassaient sous l'image, ce qui cassait la colonne. Mettre la
              description DANS la colonne de droite corrigeait ça mais laissait,
              sur un texte long, une bande vide sous la jaquette. Pleine largeur
              règle les deux, et donne des lignes de ~55 caractères au lieu
              de ~38. */}
          <div style={{ display: "flex", gap: 14, marginBottom: g.style ? 12 : 16 }}>
            <Cover src={g.cover} title={g.title} size={96} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25, color: txt, marginBottom: 6 }}>{g.title}</div>
              <div style={{ color: mut, fontSize: 11, lineHeight: 1.7 }}>
                <b style={{ color: txt, fontWeight: 600 }}>{g.platform}</b> · {g.format}
                {g.genre.length > 0 && <><br />{g.genre.join(" · ")}</>}
                {g.metacritic ? <><br />Metacritic <b style={{ color: noteCouleur, fontWeight: 700 }}>{g.metacritic}</b></> : null}
                <br />Ajouté le {new Date(g.addedDate).toLocaleDateString("fr-FR")}
              </div>
            </div>
          </div>

          {g.style && (
            <div style={{ marginBottom: 16 }}>
              {/* En italique gris coupé à deux lignes, le seul texte qu'on ait
                  envie de lire était le plus pénible de la fiche. */}
              <div style={{ color: txt, fontSize: 13, lineHeight: 1.5, ...(descOpen ? {} : { overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical" }) }}>{g.style}</div>
              {g.style.length > 160 && <button onClick={() => setDescOpen(o => !o)} style={{ background: "transparent", border: "none", color: "#5493FF", fontSize: 11, cursor: "pointer", padding: "6px 0 0" }}>{descOpen ? "▴ Réduire" : "▾ Lire la suite"}</button>}
            </div>
          )}

          {/* Infos Wikidata : des filets, plus un cadre (voir InfoboxView). */}
          {g.infobox && <div style={{ marginBottom: 16 }}><InfoboxView info={g.infobox} /></div>}

          {/* Possession : format, rétrocompatibilité et prêt réunis, puisque
              c'est le même sujet — mon exemplaire. Un fond, pas une bordure :
              six blocs encadrés de poids égal ne hiérarchisaient rien. */}
          <div style={{ background: bg, borderRadius: 10, padding: 12, marginBottom: 4 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: mut, fontSize: 11, flex: "0 0 52px", paddingTop: 10 }}>Format</span>
              <div style={{ display: "flex", border: `1px solid ${bdr}`, borderRadius: 8, overflow: "hidden" }}>
                {["physique", "démat"].map(f => (
                  <button key={f} onClick={() => onEdit(g.id, "format", f)} aria-pressed={g.format === f}
                    style={{ background: g.format === f ? "#5493FF22" : "transparent", border: "none", color: g.format === f ? "#5493FF" : mut, fontWeight: g.format === f ? 600 : 400, fontSize: 12, padding: "0 14px", height: 36, cursor: "pointer" }}>{f}</button>
                ))}
              </div>
            </div>

            {BACK_COMPAT_PARENT[g.platform] && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 12 }}>
                <span style={{ color: mut, fontSize: 11, flex: "0 0 52px", paddingTop: 10 }}>Sur {BACK_COMPAT_PARENT[g.platform].replace("Xbox ", "")}</span>
                <div style={{ display: "flex", border: `1px solid ${bdr}`, borderRadius: 8, overflow: "hidden" }}>
                  {[["oui", true], ["non", false]].map(([label, val]) => (
                    <button key={label} onClick={() => onEdit(g.id, "backCompat", val)} aria-pressed={!!g.backCompat === val}
                      style={{ background: !!g.backCompat === val ? (val ? "#22c55e22" : "#ef444422") : "transparent", border: "none", color: !!g.backCompat === val ? (val ? "#22c55e" : "#ef4444") : mut, fontWeight: !!g.backCompat === val ? 600 : 400, fontSize: 12, padding: "0 16px", height: 36, cursor: "pointer" }}>{label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Le prêt était enfermé dans un accordéon, et « rendu » se devinait
                en vidant le champ du nom. */}
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 12 }}>
              <span style={{ color: mut, fontSize: 11, flex: "0 0 52px", paddingTop: 10 }}>Prêt</span>
              {g.lentA ? (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600, paddingTop: 2 }}>📤 Prêté à {g.lentA}</div>
                  <div style={{ color: "#f59e0b", fontSize: 11, margin: "2px 0 8px" }}>
                    Depuis le {new Date(g.lentDate).toLocaleDateString("fr-FR")}
                    {jours !== null ? ` · ${jours} jour${jours > 1 ? "s" : ""}` : ""}
                    {enRetard ? " ⚠️" : ""}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => { onEdit(g.id, "lentA", null); onEdit(g.id, "lentDate", null); setLoanName(""); }}
                      style={{ height: 36, padding: "0 14px", background: "#22c55e22", border: "1px solid #22c55e", color: "#22c55e", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>✓ Rendu</button>
                    <a href={`sms:?body=${encodeURIComponent(`Salut ! Tu penses à me rendre ${g.title} ? 😊`)}`}
                      style={{ height: 36, padding: "0 14px", display: "inline-flex", alignItems: "center", background: "transparent", border: `1px solid ${bdr}`, color: txt, borderRadius: 8, fontSize: 12, textDecoration: "none" }}>Relancer par SMS</a>
                  </div>
                </div>
              ) : pretOuvert ? (
                <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 6 }}>
                  <input value={loanName} onChange={e => setLoanName(e.target.value)} placeholder="Nom…" autoFocus
                    aria-label="Nom de la personne à qui prêter ce jeu"
                    style={{ flex: 1, minWidth: 0, height: 36, background: "transparent", border: `1px solid ${bdr}`, borderRadius: 8, color: txt, padding: "0 10px", fontSize: 12, outline: "none" }} />
                  <button onClick={() => { const n = loanName.trim(); if (!n) return; onEdit(g.id, "lentA", n); onEdit(g.id, "lentDate", new Date().toISOString().slice(0, 10)); setPretOuvert(false); }}
                    disabled={!loanName.trim()}
                    style={{ height: 36, padding: "0 14px", background: loanName.trim() ? "#f59e0b22" : "transparent", border: `1px solid ${loanName.trim() ? "#f59e0b" : bdr}`, color: loanName.trim() ? "#f59e0b" : mut, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: loanName.trim() ? "pointer" : "default" }}>Prêter</button>
                </div>
              ) : (
                <button onClick={() => setPretOuvert(true)}
                  style={{ height: 36, padding: "0 14px", background: "transparent", border: `1px solid ${bdr}`, color: txt, borderRadius: 8, fontSize: 12, cursor: "pointer" }}>📤 Prêter ce jeu</button>
              )}
            </div>
          </div>

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
            <>
              <textarea value={g.tips || ""} onChange={e => onEdit(g.id, "tips", e.target.value)} placeholder="Notes & tips perso…" rows={2} style={{ width: "100%", background: "transparent", border: `1px solid ${bdr}`, borderRadius: 6, color: txt, padding: "6px 8px", fontSize: 11, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
              {/* La recherche interrogeait déjà `g.tag`, mais rien ne permettait
                  de l'écrire : chercher par tag ne pouvait par construction rien
                  trouver. */}
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
                <span style={{ color: mut, fontSize: 11, flexShrink: 0 }}>Tag :</span>
                <input value={g.tag || ""} onChange={e => onEdit(g.id, "tag", e.target.value)}
                  placeholder="coop, à revendre, prêt à Paul…"
                  aria-label="Tag libre, utilisable dans la recherche"
                  style={{ flex: 1, minWidth: 0, minHeight: 32, background: "transparent", border: `1px solid ${bdr}`, borderRadius: 6, color: txt, padding: "2px 8px", fontSize: 11, outline: "none" }} />
              </div>
            </>
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
                      {s.background_image && <img src={s.background_image} alt="" style={{ width: 34, height: 51, minWidth: 34, objectFit: "cover", borderRadius: 4 }} />}
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
          {/* Outils. « Ajouté le » était orphelin en bas à gauche, calé contre
              quatre boutons qui débordaient sur deux lignes — et Supprimer,
              irréversible, partageait le groupe de trois actions d'enrichissement.
              La date est remontée dans l'identité ; les sources se rangent
              derrière un bouton, puisqu'on enrichit un jeu une fois. */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 12, borderTop: `1px solid ${bdr}` }}>
            <button onClick={() => setSourcesOuvertes(o => !o)}
              style={{ height: 38, padding: "0 14px", background: sourcesOuvertes ? "#5493FF22" : "transparent", border: `1px solid ${sourcesOuvertes ? "#5493FF" : bdr}`, color: sourcesOuvertes ? "#5493FF" : mut, borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
              ⋯ Sources
            </button>
            <button onClick={() => onDelete(g)}
              style={{ marginLeft: "auto", height: 38, padding: "0 10px", background: "transparent", border: "none", color: "#ef4444", fontSize: 12, cursor: "pointer", opacity: 0.85 }}>
              Supprimer
            </button>
          </div>

          {sourcesOuvertes && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              <button onClick={() => { setRawgOpen(o => !o); if (!rawgOpen) { setRawgQ(g.title); rawgQuery(g.title); } }} style={boutonSource}>🔄 RAWG</button>
              <button onClick={() => { setWikiOpen(o => !o); if (!wikiOpen) { setWikiQ(g.title); setWikiDone(false); wikiQuery(g.title); } }} style={boutonSource}>🇫🇷 Titre français</button>
              <button onClick={() => { setSgdbOpen(o => !o); if (!sgdbOpen) { setSgdbQ(g.title); setSgdbDone(false); sgdbQuery(g.title); } }} style={boutonSource}>📦 Jaquette</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Mémoïsé : le moindre changement dans la bibliothèque rerendait les 30 fiches
// visibles, chacune portant une vingtaine de useState. Les fonctions passées en
// props sont stables (useCallback côté App), donc la comparaison par défaut
// suffit — seule la fiche réellement modifiée se rerend.
export default memo(GameCard);
