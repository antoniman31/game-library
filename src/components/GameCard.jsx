import { memo, useState, useEffect, useRef } from "react";
import Cover from "./Cover.jsx";
import InfoboxView from "./InfoboxView.jsx";
import Sheet from "./Sheet.jsx";
import { bg, card, bdr, txt, mut, demat, accent, accentDoux, accentFond, okDoux, warnDoux, dangerDoux, ok, warn, warnFond, danger } from "../lib/theme.js";
import { PLATFORM_COLORS, BACK_COMPAT_PARENT, PLATFORMES_JEU, estUrlImage, joursDePret, pretEnRetard, brouillonDepuisJeu, validerEdition,
  rendreJeu, preterJeu, annulerPret, dureeEntreeHistorique } from "../lib/model.js";
import {
  rawgSearch, rawgDetail, wikiFrenchTitles, wikiArticleData, wikidataInfobox,
  sgdbSearch, sgdbGrids,
} from "../lib/api.js";

// Deux valeurs exclusives, côte à côte : plus lisible qu'une case à cocher
// quand le « non » compte autant que le « oui ».
const Segment = ({ options, valeur, onChange }) => (
  <div style={{ display: "flex", border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", overflow: "hidden", width: "fit-content" }}>
    {options.map(([libelle, val, teinte = accent]) => {
      const actif = valeur === val;
      return (
        <button key={libelle} type="button" onClick={() => onChange(val)} aria-pressed={actif}
          style={{
            background: actif ? `${teinte}22` : "transparent", border: "none",
            color: actif ? teinte : mut, fontWeight: actif ? 600 : 400,
            fontSize: 12, padding: "0 16px", minHeight: "var(--tap-min)", cursor: "pointer", fontFamily: "inherit",
          }}>{libelle}</button>
      );
    })}
  </div>
);

const boutonSource = { minHeight: "var(--tap-min)", padding: "0 12px", background: "transparent", border: `1px solid ${accent}`, color: accent, borderRadius: "var(--r-sm)", fontSize: 11, cursor: "pointer" };

function GameCard({ g, onEdit, onDelete, onEnrich, autoOpen, onOuverte }) {
  const [open, setOpen] = useState(!!autoOpen);
  const rootRef = useRef(null);
  // L'ouverture automatique n'a lieu qu'une fois : le marqueur est consommé
  // aussitôt, sans quoi la fiche se rouvre à chaque remontage — au retour d'un
  // autre onglet, par exemple — alors qu'on l'avait refermée.
  useEffect(() => {
    if (!autoOpen) return;
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    onOuverte?.();
  }, []); // eslint-disable-line
  const [loanName, setLoanName] = useState(g.lentA || "");
  const [loanRetour, setLoanRetour] = useState("");
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
  const [editionOuverte, setEditionOuverte] = useState(false);
  const [brouillon, setBrouillon] = useState(null);
  const [erreurs, setErreurs] = useState({});
  const [section, setSection] = useState(null);
  const toggle = s => setSection(c => c === s ? null : s);

  // Le traitement qui signalait les jeux délaissés — bordure en pointillés et
  // opacité réduite — sert désormais au seul signal qui reste : un prêt qui
  // s'éternise se repère dans la liste sans ouvrir l'onglet Prêts.
  const enRetard = pretEnRetard(g);
  const jours = joursDePret(g);
  const baseBorder = enRetard ? warn : bdr;
  const noteCouleur = g.metacritic >= 80 ? ok : g.metacritic >= 60 ? warn : danger;

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

  // Édition manuelle. La saisie va dans un brouillon local, pas dans la
  // bibliothèque : « Annuler » retrouve vraiment l'état d'avant, et taper une
  // description n'écrit pas dans le stockage à chaque lettre.
  const ouvrirEdition = () => { setBrouillon(brouillonDepuisJeu(g)); setErreurs({}); setEditionOuverte(true); };
  const fermerEdition = () => { setEditionOuverte(false); setBrouillon(null); setErreurs({}); };
  // Le fond de la feuille se ferme au clic : sans garde-fou, un doigt à côté
  // jetterait une correction en cours sans rien dire.
  const brouillonModifie = () => !!brouillon && JSON.stringify(brouillon) !== JSON.stringify(brouillonDepuisJeu(g));
  const demanderFermeture = () => { if (brouillonModifie() && !window.confirm("Abandonner les modifications ?")) return; fermerEdition(); };
  const champ = (k, v) => setBrouillon(b => {
    const suivant = { ...b, [k]: v };
    // Une plateforme sans console parente ne peut pas être rétrocompatible :
    // la ligne disparaît de l'écran, la valeur doit disparaître avec elle.
    if (k === "platform" && !BACK_COMPAT_PARENT[v]) suivant.backCompat = false;
    return suivant;
  });
  const enregistrer = () => {
    const { erreurs: err, valeurs } = validerEdition(brouillon);
    setErreurs(err);
    if (Object.keys(err).length) return;
    onEnrich(g.id, valeurs);
    fermerEdition();
  };

  const champStyle = (k) => ({
    // Fond plus sombre que la feuille, comme les champs de la fenêtre d'ajout :
    // sur fond `card`, un champ `card` ne se distinguait que par son liseré.
    width: "100%", boxSizing: "border-box", background: bg, minHeight: "var(--tap-min)",
    border: `1px solid ${erreurs[k] ? danger : bdr}`, borderRadius: "var(--r-sm)",
    color: txt, padding: "7px 9px", fontSize: 12,
    fontFamily: "inherit", // sans quoi textarea et champ date passent en monospace
  });
  // Balise : un <label> autour de boutons transmet le clic sur le texte au
  // premier bouton — soit, pour « Format », un basculement à « physique ».
  const ligneEdition = (label, cle, controle, aide, Balise = "label") => (
    <Balise style={{ display: "block", marginBottom: 10 }}>
      <span style={{ display: "block", color: mut, fontSize: 11, marginBottom: 4 }}>
        {label}{aide ? <span style={{ opacity: 0.75 }}> · {aide}</span> : null}
      </span>
      {controle}
      {erreurs[cle] && <span style={{ display: "block", color: danger, fontSize: 11, marginTop: 3 }}>{erreurs[cle]}</span>}
    </Balise>
  );

  const acc = (id, title, content) => (
    // Un filet suffit à séparer : encadrer chaque section donnait six
    // rectangles de poids identique, et donc aucune hiérarchie.
    <div>
      <button onClick={() => toggle(id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", boxSizing: "border-box", background: "transparent", border: "none", borderTop: `1px solid ${bdr}`, minHeight: "var(--tap-min)", padding: "13px 2px", color: txt, fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
        <span>{title}</span>
        <span style={{ color: mut }}>{section === id ? "▾" : "▸"}</span>
      </button>
      {section === id && <div style={{ padding: "0 2px 12px" }}>{content}</div>}
    </div>
  );

  return (
    <div ref={rootRef} className="gl-card" style={{ background: card, border: `1px ${enRetard ? "dashed" : "solid"} ${baseBorder}`, borderRadius: "var(--r-md)", overflow: "hidden", transition: "border-color 0.2s" }}>

      <div style={{ display: "flex", gap: 8, padding: "8px 10px", cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <Cover src={g.cover} title={g.title} size={46} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ background: PLATFORM_COLORS[g.platform] || accentFond, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: "var(--r-xs)", padding: "1px 5px" }}>{g.platform}</span>
            {g.format === "démat" && <span style={{ background: demat, color: accent, fontSize: 11, borderRadius: "var(--r-xs)", padding: "1px 5px" }}>démat</span>}
            {BACK_COMPAT_PARENT[g.platform] && g.backCompat && <span title={`Rétrocompatible ${BACK_COMPAT_PARENT[g.platform]}`} style={{ background: "#107C1022", color: ok, fontSize: 11, borderRadius: "var(--r-xs)", padding: "1px 5px" }}>🔄 Compatible {BACK_COMPAT_PARENT[g.platform].replace("Xbox ", "")}</span>}
            {g.lentA && <span key={g.lentA} style={{ background: "#7c320044", color: warn, fontSize: 11, borderRadius: "var(--r-xs)", padding: "1px 5px", animation: "statusPop 200ms ease" }}>📤 {g.lentA}{jours !== null ? ` · ${jours}j` : ""}</span>}
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
      <div style={{ height: 2, background: g.lentA ? warnFond : "transparent" }} />

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
              <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.25, color: txt, marginBottom: 6 }}>{g.title}</div>
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
              {g.style.length > 160 && <button onClick={() => setDescOpen(o => !o)} style={{ background: "transparent", border: "none", color: accent, fontSize: 11, cursor: "pointer", padding: "6px 0 0" }}>{descOpen ? "▴ Réduire" : "▾ Lire la suite"}</button>}
            </div>
          )}

          {/* Infos Wikidata : des filets, plus un cadre (voir InfoboxView). */}
          {g.infobox && <div style={{ marginBottom: 16 }}><InfoboxView info={g.infobox} /></div>}

          {/* Le prêt, et lui seul. Le format et la rétrocompatibilité tenaient
              ici la même place, alors qu'on les règle une fois dans la vie d'un
              jeu : ils sont passés dans « Modifier la fiche », avec le reste de
              ce qui se corrige. Les pastilles en haut de la carte continuent de
              les annoncer d'un coup d'œil.

              Le prêt reste : c'est une action, répétée, et il était auparavant
              enfermé dans un accordéon où « rendu » se devinait en vidant le
              champ du nom. */}
          <div style={{ background: bg, borderRadius: "var(--r-md)", padding: 12, marginBottom: 4 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: mut, fontSize: 11, flex: "0 0 52px", paddingTop: 10 }}>Prêt</span>
              {g.lentA ? (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: warn, fontSize: 12, fontWeight: 600, paddingTop: 2 }}>📤 Prêté à {g.lentA}</div>
                  <div style={{ color: warn, fontSize: 11, margin: "2px 0 8px" }}>
                    Depuis le {new Date(g.lentDate).toLocaleDateString("fr-FR")}
                    {jours !== null ? ` · ${jours} jour${jours > 1 ? "s" : ""}` : ""}
                    {enRetard ? " ⚠️" : ""}
                    {g.lentRetourPrevu && <><br />À rendre le {new Date(g.lentRetourPrevu).toLocaleDateString("fr-FR")}</>}
                  </div>
                  <div style={{ display: "flex", gap: "var(--ecart-tap)", flexWrap: "wrap" }}>
                    <button onClick={() => { onEnrich(g.id, rendreJeu(g)); setLoanName(""); setLoanRetour(""); }}
                      style={{ minHeight: "var(--tap-min)", padding: "0 14px", background: okDoux, border: `1px solid ${ok}`, color: ok, borderRadius: "var(--r-sm)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>✓ Rendu</button>
                    <a href={`sms:?body=${encodeURIComponent(`Salut ! Tu penses à me rendre ${g.title} ? 😊`)}`}
                      style={{ minHeight: "var(--tap-min)", padding: "0 14px", display: "inline-flex", alignItems: "center", background: "transparent", border: `1px solid ${bdr}`, color: txt, borderRadius: "var(--r-sm)", fontSize: 12, textDecoration: "none" }}>Relancer par SMS</a>
                    {/* « Rendu » archive et nourrit les statistiques ; un prêt
                        saisi par erreur doit pouvoir disparaître sans y entrer. */}
                    <button onClick={() => {
                        if (!window.confirm(`Supprimer ce prêt à ${g.lentA} ?\n\nIl ne sera pas enregistré dans l'historique — à utiliser si le prêt n'a jamais eu lieu.`)) return;
                        onEnrich(g.id, annulerPret(g)); setLoanName(""); setLoanRetour("");
                      }}
                      style={{ minHeight: "var(--tap-min)", padding: "0 12px", background: "transparent", border: "none", color: danger, fontSize: 12, cursor: "pointer", opacity: 0.85 }}>Supprimer</button>
                  </div>
                </div>
              ) : pretOuvert ? (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", color: mut, fontSize: 11, marginBottom: 4 }}>Prêté à</span>
                  <div style={{ display: "flex", gap: "var(--ecart-tap)" }}>
                    <input value={loanName} onChange={e => setLoanName(e.target.value)} placeholder="Nom…" autoFocus
                      aria-label="Nom de la personne à qui prêter ce jeu"
                      style={{ flex: 1, minWidth: 0, minHeight: "var(--tap-min)", background: "transparent", border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", color: txt, padding: "0 10px", fontSize: 12, fontFamily: "inherit" }} />
                    <button onClick={() => { const j = preterJeu(g, loanName, loanRetour); if (j === g) return; onEnrich(g.id, j); setPretOuvert(false); setLoanRetour(""); }}
                      disabled={!loanName.trim()}
                      style={{ minHeight: "var(--tap-min)", padding: "0 14px", background: loanName.trim() ? warnDoux : "transparent", border: `1px solid ${loanName.trim() ? warn : bdr}`, color: loanName.trim() ? warn : mut, borderRadius: "var(--r-sm)", fontSize: 12, fontWeight: 600, cursor: loanName.trim() ? "pointer" : "default" }}>Prêter</button>
                  </div>
                  {/* Facultatif : sans date, le seuil de 30 jours reste le repli. */}
                  <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
                    <span style={{ color: mut, fontSize: 11, flexShrink: 0 }}>À rendre le</span>
                    <input type="date" value={loanRetour} onChange={e => setLoanRetour(e.target.value)}
                      style={{ flex: 1, minWidth: 0, minHeight: "var(--tap-min)", background: "transparent", border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", color: txt, padding: "0 8px", fontSize: 12, fontFamily: "inherit" }} />
                  </label>
                </div>
              ) : (
                <button onClick={() => setPretOuvert(true)}
                  style={{ minHeight: "var(--tap-min)", padding: "0 14px", background: "transparent", border: `1px solid ${bdr}`, color: txt, borderRadius: "var(--r-sm)", fontSize: 12, cursor: "pointer" }}>📤 Prêter ce jeu</button>
              )}
            </div>
          </div>

          {/* Ce jeu a-t-il déjà voyagé ? La question que « Rendu » effaçait. */}
          {g.pretsPasses?.length > 0 && (
            <div style={{ color: mut, fontSize: 11, lineHeight: 1.6, padding: "10px 2px 2px" }}>
              Déjà prêté {g.pretsPasses.length} fois : {g.pretsPasses.map(e => `${e.a} (${dureeEntreeHistorique(e)} j)`).join(" · ")}
            </div>
          )}

          {/* Liens & contenu (accordéon) */}
          {acc("links", "🔗 Liens & contenu", (
            <>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(g.title + " official trailer")}`} target="_blank" rel="noreferrer" style={{ background: dangerDoux, border: `1px solid ${danger}`, color: danger, borderRadius: "var(--r-xs)", padding: "3px 8px", fontSize: 11, textDecoration: "none" }}>▶ Trailer</a>
                <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(g.title + " gameplay français")}`} target="_blank" rel="noreferrer" style={{ background: dangerDoux, border: `1px solid ${danger}`, color: danger, borderRadius: "var(--r-xs)", padding: "3px 8px", fontSize: 11, textDecoration: "none" }}>▶ Gameplay FR</a>
                <a href={`https://www.jeuxvideo.com/recherche/?q=${encodeURIComponent(g.title)}`} target="_blank" rel="noreferrer" style={{ background: accentDoux, border: `1px solid ${accent}`, color: accent, borderRadius: "var(--r-xs)", padding: "3px 8px", fontSize: 11, textDecoration: "none" }}>JVC</a>
                <a href={`https://www.ign.com/search?q=${encodeURIComponent(g.title)}`} target="_blank" rel="noreferrer" style={{ background: accentDoux, border: `1px solid ${accent}`, color: accent, borderRadius: "var(--r-xs)", padding: "3px 8px", fontSize: 11, textDecoration: "none" }}>IGN</a>
              </div>
              {[0,1,2].map(i => (
                <label key={i} style={{ display: "block", marginBottom: 6 }}>
                  <span style={{ display: "block", color: mut, fontSize: 11, marginBottom: 2 }}>{["Soluce","Wiki","Ma playlist YouTube"][i]}</span>
                  <input value={g.myLinks[i] || ""} onChange={e => { const l = [...g.myLinks]; l[i] = e.target.value; onEdit(g.id, "myLinks", l); }}
                    placeholder="https://…"
                    style={{ display: "block", width: "100%", background: "transparent", border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", color: txt, padding: "4px 8px", fontSize: 11, boxSizing: "border-box" }} />
                </label>
              ))}
              {g.myLinks.filter(Boolean).map((url, i) => <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: "block", color: accent, fontSize: 11, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</a>)}
            </>
          ))}

          {/* Notes (accordéon) */}
          {acc("notes", "📝 Notes", (
            <>
              <textarea value={g.tips || ""} onChange={e => onEdit(g.id, "tips", e.target.value)} placeholder="Notes & tips perso…" rows={2} style={{ width: "100%", background: "transparent", border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", color: txt, padding: "6px 8px", fontSize: 11, resize: "vertical", boxSizing: "border-box" }} />
              {/* La recherche interrogeait déjà `g.tag`, mais rien ne permettait
                  de l'écrire : chercher par tag ne pouvait par construction rien
                  trouver. */}
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
                <span style={{ color: mut, fontSize: 11, flexShrink: 0 }}>Tag :</span>
                <input value={g.tag || ""} onChange={e => onEdit(g.id, "tag", e.target.value)}
                  placeholder="coop, à revendre, prêt à Paul…"
                  aria-label="Tag libre, utilisable dans la recherche"
                  style={{ flex: 1, minWidth: 0, minHeight: "var(--tap-min)", background: "transparent", border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", color: txt, padding: "2px 8px", fontSize: 11 }} />
              </div>
            </>
          ))}
          {/* Re-association RAWG */}
          {rawgOpen && (
            <Sheet title="Ré-associer depuis RAWG" onClose={() => setRawgOpen(false)}>
              <input value={rawgQ} onChange={e => rawgQuery(e.target.value)} placeholder="Titre du jeu…" autoFocus style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", color: txt, padding: "6px 8px", fontSize: 12 }} />
              {rawgBusy && <div style={{ color: accent, fontSize: 11, marginTop: 4 }}>Récupération & traduction…</div>}
              {rawgSugg.length > 0 && !rawgBusy && (
                <div style={{ marginTop: 6, background: card, border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", maxHeight: 300, overflowY: "auto", boxShadow: "0 8px 24px #0008" }}>
                  {rawgSugg.map(s => (
                    <div key={s.id} className="gl-row" onClick={() => rawgPick(s)} style={{ display: "flex", gap: 8, padding: "7px 9px", cursor: "pointer", borderBottom: `1px solid ${bdr}`, alignItems: "center" }}>
                      {s.background_image && <img src={s.background_image} alt="" style={{ width: 34, height: 51, minWidth: 34, objectFit: "cover", borderRadius: "var(--r-xs)" }} />}
                      <div style={{ minWidth: 0 }}><div style={{ color: txt, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div><div style={{ color: mut, fontSize: 11 }}>{s.released}{s.metacritic ? ` · MC ${s.metacritic}` : ""}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </Sheet>
          )}
          {/* Titre français via Wikipédia FR */}
          {wikiOpen && (
            <Sheet title="Titre français (Wikipédia)" onClose={() => setWikiOpen(false)}>
              <input value={wikiQ} onChange={e => wikiQuery(e.target.value)} placeholder="Titre du jeu…" autoFocus style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", color: txt, padding: "6px 8px", fontSize: 12 }} />
              {wikiBusy && <div style={{ color: accent, fontSize: 11, marginTop: 4 }}>Recherche…</div>}
              {!wikiBusy && wikiSugg.length > 0 && (
                <div style={{ marginTop: 6, background: card, border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", maxHeight: 300, overflowY: "auto", boxShadow: "0 8px 24px #0008" }}>
                  {wikiSugg.map((s, i) => (
                    <div key={i} className="gl-row" style={{ display: "flex", gap: 8, padding: "7px 9px", borderBottom: `1px solid ${bdr}`, alignItems: "center" }}>
                      <div onClick={() => wikiPick(s.title)} style={{ flex: 1, minWidth: 0, cursor: "pointer", color: txt, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                      {s.url && <a href={s.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} title="Voir la page Wikipédia" style={{ color: accent, fontSize: 11, textDecoration: "none", flexShrink: 0 }}>↗ page</a>}
                    </div>
                  ))}
                </div>
              )}
              {!wikiBusy && wikiDone && wikiSugg.length === 0 && !wikiPicked && <div style={{ color: mut, fontSize: 11, marginTop: 6 }}>Aucun titre français trouvé</div>}

              {wikiFetching && <div style={{ color: accent, fontSize: 11, marginTop: 8 }}>Chargement de la fiche Wikipédia…</div>}

              {/* Résumé Wikipédia */}
              {wikiExtract && (
                <div style={{ marginTop: 10, borderTop: `1px solid ${bdr}`, paddingTop: 8 }}>
                  <div style={{ color: txt, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Résumé Wikipédia</div>
                  <div style={{ color: mut, fontSize: 11, fontStyle: "italic", lineHeight: 1.4, maxHeight: 96, overflowY: "auto", marginBottom: 6 }}>{wikiExtract}</div>
                  <div style={{ display: "flex", gap: "var(--ecart-tap)", flexWrap: "wrap" }}>
                    <button onClick={() => { onEdit(g.id, "style", wikiExtract); setWikiExtract(null); }} style={{ background: okDoux, border: `1px solid ${ok}`, color: ok, borderRadius: "var(--r-sm)", padding: "0 10px", minHeight: "var(--tap-min)", fontSize: 11, cursor: "pointer" }}>Utiliser ce résumé</button>
                    <button onClick={() => setWikiExtract(null)} style={{ background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: "var(--r-sm)", padding: "0 10px", minHeight: "var(--tap-min)", fontSize: 11, cursor: "pointer" }}>Garder la description actuelle</button>
                  </div>
                </div>
              )}

              {/* Jaquette Wikipédia */}
              {wikiImage && (
                <div style={{ marginTop: 10, borderTop: `1px solid ${bdr}`, paddingTop: 8 }}>
                  <div style={{ color: txt, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Jaquette Wikipédia</div>
                  <img src={wikiImage} alt="" style={{ maxWidth: 120, maxHeight: 160, objectFit: "contain", borderRadius: "var(--r-sm)", border: `1px solid ${bdr}`, display: "block", marginBottom: 6 }} />
                  <div style={{ display: "flex", gap: "var(--ecart-tap)", flexWrap: "wrap" }}>
                    <button onClick={() => { onEdit(g.id, "cover", wikiImage); setWikiImage(null); }} style={{ background: okDoux, border: `1px solid ${ok}`, color: ok, borderRadius: "var(--r-sm)", padding: "0 10px", minHeight: "var(--tap-min)", fontSize: 11, cursor: "pointer" }}>Utiliser cette jaquette</button>
                    <button onClick={() => setWikiImage(null)} style={{ background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: "var(--r-sm)", padding: "0 10px", minHeight: "var(--tap-min)", fontSize: 11, cursor: "pointer" }}>Garder la jaquette actuelle</button>
                  </div>
                </div>
              )}

              {/* Infos Wikidata */}
              {wikiInfo && (
                <div style={{ marginTop: 10, borderTop: `1px solid ${bdr}`, paddingTop: 8 }}>
                  <div style={{ color: txt, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>ℹ️ Infos (Wikidata)</div>
                  <div style={{ marginBottom: 6 }}><InfoboxView info={wikiInfo} /></div>
                  <div style={{ display: "flex", gap: "var(--ecart-tap)", flexWrap: "wrap" }}>
                    <button onClick={() => { onEdit(g.id, "infobox", wikiInfo); setWikiInfo(null); }} style={{ background: okDoux, border: `1px solid ${ok}`, color: ok, borderRadius: "var(--r-sm)", padding: "0 10px", minHeight: "var(--tap-min)", fontSize: 11, cursor: "pointer" }}>Utiliser ces infos</button>
                    <button onClick={() => setWikiInfo(null)} style={{ background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: "var(--r-sm)", padding: "0 10px", minHeight: "var(--tap-min)", fontSize: 11, cursor: "pointer" }}>Ignorer</button>
                  </div>
                </div>
              )}
            </Sheet>
          )}
          {/* Jaquettes SteamGridDB */}
          {sgdbOpen && (
            <Sheet title="Choisir une jaquette" onClose={() => setSgdbOpen(false)}>
              <input value={sgdbQ} onChange={e => sgdbQuery(e.target.value)} placeholder="Titre du jeu…" autoFocus style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", color: txt, padding: "6px 8px", fontSize: 12 }} />
              {sgdbBusy && <div style={{ color: accent, fontSize: 11, marginTop: 6 }}>Recherche des jaquettes…</div>}
              {!sgdbBusy && sgdbGridsList.length > 0 && (
                <>
                  {sgdbMatch && <div style={{ color: mut, fontSize: 11, marginTop: 6 }}>Trouvé : <span style={{ color: txt, fontWeight: 600 }}>{sgdbMatch}</span></div>}
                  <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                    {sgdbGridsList.map((grid, i) => (
                      <img key={i} className="gl-thumb" src={grid.thumb} alt="" loading="lazy" onClick={() => sgdbPick(grid.url)} title="Utiliser cette jaquette"
                        style={{ width: "100%", aspectRatio: "2 / 3", objectFit: "cover", borderRadius: "var(--r-sm)", border: `1px solid ${bdr}`, cursor: "pointer", display: "block" }} />
                    ))}
                  </div>
                </>
              )}
              {!sgdbBusy && sgdbDone && sgdbGridsList.length === 0 && <div style={{ color: mut, fontSize: 11, marginTop: 6 }}>Aucune jaquette trouvée sur SteamGridDB</div>}
            </Sheet>
          )}
          {/* Outils. « Ajouté le » était orphelin en bas à gauche, calé contre
              quatre boutons qui débordaient sur deux lignes — et Supprimer,
              irréversible, partageait le groupe de trois actions d'enrichissement.
              La date est remontée dans l'identité ; correction manuelle et
              re-recherches se rangent derrière un bouton, puisqu'on ne retouche
              un jeu qu'une fois. */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 12, borderTop: `1px solid ${bdr}` }}>
            <button onClick={() => setSourcesOuvertes(o => !o)}
              style={{ minHeight: "var(--tap-min)", padding: "0 14px", background: sourcesOuvertes ? accentDoux : "transparent", border: `1px solid ${sourcesOuvertes ? accent : bdr}`, color: sourcesOuvertes ? accent : mut, borderRadius: "var(--r-sm)", fontSize: 12, cursor: "pointer" }}>
              ⋯ Modifier la fiche
            </button>
            <button onClick={() => onDelete(g)}
              style={{ marginLeft: "auto", minHeight: "var(--tap-min)", padding: "0 10px", background: "transparent", border: "none", color: danger, fontSize: 12, cursor: "pointer", opacity: 0.85 }}>
              Supprimer
            </button>
          </div>

          {sourcesOuvertes && (
            <div style={{ display: "flex", gap: "var(--ecart-tap)", flexWrap: "wrap", marginTop: 10 }}>
              <button onClick={() => { setSourcesOuvertes(false); ouvrirEdition(); }}
                style={{ ...boutonSource, background: accentDoux, fontWeight: 600 }}>✏️ À la main</button>
              <button onClick={() => { setSourcesOuvertes(false); setRawgOpen(true); setRawgQ(g.title); rawgQuery(g.title); }} style={boutonSource}>🔄 RAWG</button>
              <button onClick={() => { setSourcesOuvertes(false); setWikiOpen(true); setWikiQ(g.title); setWikiDone(false); wikiQuery(g.title); }} style={boutonSource}>🇫🇷 Titre français</button>
              <button onClick={() => { setSourcesOuvertes(false); setSgdbOpen(true); setSgdbQ(g.title); setSgdbDone(false); sgdbQuery(g.title); }} style={boutonSource}>📦 Jaquette</button>
            </div>
          )}

          {/* Édition manuelle. Les sources automatiques écrivent le titre, la
              plateforme, les genres, la note, la jaquette, la description et
              l'infobox ; rien ne permettait de les corriger quand elles se
              trompaient, sinon supprimer le jeu et le recréer. */}
          {editionOuverte && brouillon && (
            <Sheet title="Corriger les informations" onClose={demanderFermeture}>

              {ligneEdition("Titre", "title", <input value={brouillon.title} onChange={e => champ("title", e.target.value)} style={champStyle("title")} />)}

              {ligneEdition("Plateforme", "platform", (
                <select value={brouillon.platform} onChange={e => champ("platform", e.target.value)} style={{ ...champStyle("platform"), minHeight: "var(--tap-min)" }}>
                  {PLATFORMES_JEU.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ))}

              {ligneEdition("Format", "format", (
                <Segment valeur={brouillon.format} onChange={v => champ("format", v)}
                  options={[["physique", "physique"], ["démat", "démat"]]} />
              ), null, "div")}

              {BACK_COMPAT_PARENT[brouillon.platform] && ligneEdition(
                `Jouable sur ${BACK_COMPAT_PARENT[brouillon.platform].replace("Xbox ", "")}`, "backCompat", (
                  <Segment valeur={brouillon.backCompat} onChange={v => champ("backCompat", v)}
                    options={[["oui", true, ok], ["non", false, danger]]} />
                ), "rétrocompatibilité", "div")}

              {ligneEdition("Genres", "genre", <input value={brouillon.genre} onChange={e => champ("genre", e.target.value)} placeholder="Action, Aventure…" style={champStyle("genre")} />, "séparés par des virgules")}

              {ligneEdition("Metacritic", "metacritic", <input value={brouillon.metacritic} onChange={e => champ("metacritic", e.target.value)} inputMode="numeric" placeholder="vide = aucune note" style={champStyle("metacritic")} />)}

              {ligneEdition("Ajouté le", "addedDate", <input type="date" value={brouillon.addedDate} onChange={e => champ("addedDate", e.target.value)} style={champStyle("addedDate")} />)}

              {ligneEdition("Description", "style", <textarea value={brouillon.style} onChange={e => champ("style", e.target.value)} rows={6} style={{ ...champStyle("style"), resize: "vertical", lineHeight: 1.45 }} />)}

              {ligneEdition("Jaquette", "cover", (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <input value={brouillon.cover} onChange={e => champ("cover", e.target.value)} placeholder="https://… (vide = aucune)" style={{ ...champStyle("cover"), flex: 1, minWidth: 0 }} />
                  {estUrlImage(brouillon.cover) && <img src={brouillon.cover.trim()} alt="" style={{ width: 40, height: 60, objectFit: "cover", borderRadius: "var(--r-xs)", border: `1px solid ${bdr}`, flexShrink: 0 }} />}
                </div>
              ))}

              <div style={{ color: mut, fontSize: 11, fontWeight: 600, margin: "14px 0 8px", paddingTop: 10, borderTop: `1px solid ${bdr}` }}>Fiche Wikidata</div>
              {ligneEdition("Développeur", "developers", <input value={brouillon.developers} onChange={e => champ("developers", e.target.value)} style={champStyle("developers")} />, "séparés par des virgules")}
              {ligneEdition("Éditeur", "publishers", <input value={brouillon.publishers} onChange={e => champ("publishers", e.target.value)} style={champStyle("publishers")} />, "séparés par des virgules")}
              {ligneEdition("Sorties", "releases", <textarea value={brouillon.releases} onChange={e => champ("releases", e.target.value)} rows={3} placeholder={"2020-11-10 (Xbox Series X)"} style={{ ...champStyle("releases"), resize: "vertical" }} />, "une par ligne")}
              {ligneEdition("Mode", "modes", <input value={brouillon.modes} onChange={e => champ("modes", e.target.value)} placeholder="Solo, Multijoueur…" style={champStyle("modes")} />, "séparés par des virgules")}
              {ligneEdition("Série", "series", <input value={brouillon.series} onChange={e => champ("series", e.target.value)} style={champStyle("series")} />)}
              {ligneEdition("Épisode précédent", "follows", <input value={brouillon.follows} onChange={e => champ("follows", e.target.value)} style={champStyle("follows")} />)}
              {ligneEdition("Épisode suivant", "followedBy", <input value={brouillon.followedBy} onChange={e => champ("followedBy", e.target.value)} style={champStyle("followedBy")} />)}

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button onClick={enregistrer} style={{ minHeight: "var(--tap)", padding: "0 16px", background: accentFond, border: "1px solid transparent", color: "#fff", borderRadius: "var(--r-sm)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Enregistrer</button>
                <button onClick={fermerEdition} style={{ minHeight: "var(--tap)", padding: "0 14px", background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: "var(--r-sm)", fontSize: 12, cursor: "pointer" }}>Annuler</button>
              </div>
              {/* Le champ fautif peut être remonté hors de l'écran au moment
                  où on appuie sur Enregistrer : sans ce rappel, le bouton
                  paraît sans effet. */}
              {Object.keys(erreurs).length > 0 && (
                <div role="alert" style={{ color: danger, fontSize: 11, marginTop: 8 }}>⚠️ Rien n'a été enregistré : {Object.keys(erreurs).length} champ{Object.keys(erreurs).length > 1 ? "s sont signalés" : " est signalé"} plus haut, avec l'explication sous chacun.</div>
              )}
            </Sheet>
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
