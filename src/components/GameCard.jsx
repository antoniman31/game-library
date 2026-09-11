import { memo, useState, useEffect, useRef } from "react";
import Cover from "./Cover.jsx";
import InfoboxView from "./InfoboxView.jsx";
import Sheet from "./Sheet.jsx";
import { bg, card, bdr, bdrChamp, txt, mut, demat, accent, accentDoux, accentFond, okDoux, warnDoux, dangerDoux, ok, warn, warnFond, danger } from "../lib/theme.js";
import { PC, PLATFORM_COLORS, BACK_COMPAT_PARENT, PLATFORMES_JEU, estUrlImage, estLienSur, normaliserGenres, joursDePret, pretEnRetard, brouillonDepuisJeu, validerEdition,
  rendreJeu, preterJeu, annulerPret, dureeEntreeHistorique,
  fusionnerInfobox, infoboxDepuisRawg, libelleSources, CHAMPS_VIDABLES, viderChamps, jeuACompleter,
  libelleEdition } from "../lib/model.js";
import {
  rawgSearch, rawgDetail, wikiFrenchTitles, wikiArticleData, wikidataInfobox,
  sgdbSearch, sgdbGrids,
} from "../lib/api.js";

// Deux valeurs exclusives, côte à côte : plus lisible qu'une case à cocher
// quand le « non » compte autant que le « oui ».
const Segment = ({ options, valeur, onChange }) => (
  <div style={{ display: "flex", border: `1px solid ${bdrChamp}`, borderRadius: "var(--r-sm)", overflow: "hidden", width: "fit-content" }}>
    {options.map(([libelle, val, teinte = accent]) => {
      const actif = valeur === val;
      return (
        <button key={libelle} type="button" onClick={() => onChange(val)} aria-pressed={actif}
          style={{
            background: actif ? `${teinte}22` : "transparent", border: "none",
            color: actif ? teinte : mut, fontWeight: actif ? 600 : 400,
            fontSize: "var(--t-petit)", padding: "0 16px", minHeight: "var(--tap-min)", cursor: "pointer", fontFamily: "inherit",
          }}>{libelle}</button>
      );
    })}
  </div>
);

// Le champ qui ouvre chacun des trois panneaux d'une fiche. Il valait 32 px :
// sa hauteur était celle de son texte, faute de plancher — et c'est le premier
// endroit où le doigt se pose en arrivant dans le panneau.
const champRecherche = {
  width: "100%", boxSizing: "border-box", background: "transparent",
  border: `1px solid ${bdrChamp}`, borderRadius: "var(--r-sm)", color: txt,
  minHeight: "var(--tap-min)", padding: "0 10px", fontFamily: "inherit",
};

// Une suggestion à choisir dans une liste.
//
// C'étaient des <div onClick>. Trois conséquences invisibles à l'œil : la
// touche Entrée ne les activait pas, le piège à focus du panneau ne les voyait
// pas — Tab sautait donc par-dessus la liste entière — et un lecteur d'écran
// les annonçait comme du texte, sans dire qu'il y avait quelque chose à faire.
// Un <button> coûte la remise à zéro de trois styles et rend les trois.
const ligneChoix = {
  display: "flex", gap: "var(--ecart-tap)", width: "100%", alignItems: "center",
  minHeight: "var(--tap-min)", padding: "7px 9px", textAlign: "left",
  background: "transparent", border: "none", borderBottom: `1px solid ${bdr}`,
  borderRadius: 0, cursor: "pointer", fontFamily: "inherit", fontSize: "var(--t-petit)",
};

const boutonSource = { minHeight: "var(--tap-min)", padding: "0 12px", background: "transparent", border: `1px solid ${accent}`, color: accent, borderRadius: "var(--r-sm)", fontSize: "var(--t-legende)", cursor: "pointer" };

function GameCard({ g, onEdit, onDelete, onEnrich, onSerie, autresEditions: autres = [], onAutreEdition, autoOpen, onOuverte }) {
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
  const [videOpen, setVideOpen] = useState(false);
  const [videChoix, setVideChoix] = useState([]);
  const [videRien, setVideRien] = useState(false);
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
      // Le même détail rapportait déjà développeurs, éditeurs, date et tags :
      // on n'en gardait que la jaquette, la note et les genres, et on jetait le
      // reste. Il remplit maintenant l'infobox — sans écraser ce qui s'y
      // trouve, car RAWG connaît la date de l'édition possédée quand Wikidata
      // connaît mieux les studios.
      onEnrich(g.id, {
        cover: d.background_image || g.cover,
        metacritic: d.metacritic ?? g.metacritic,
        genre: d.genres ? normaliserGenres(d.genres.map(x => x.name)) : g.genre,
        infobox: fusionnerInfobox(g.infobox, infoboxDepuisRawg(d), "rawg"),
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
    // Passer un jeu en PC le rend démat ; l'en sortir lui rend un format, et
    // lui retire une boutique qui n'aurait plus de sens.
    if (k === "platform" && v === PC) suivant.format = "démat";
    if (k === "platform" && v !== PC) suivant.boutique = "";
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
    border: `1px solid ${erreurs[k] ? danger : bdrChamp}`, borderRadius: "var(--r-sm)",
    color: txt, padding: "7px 9px",
    // Pas de `fontSize` : index.css impose 16 px à tout champ de saisie, sous
    // quoi Safari iOS zoome à la prise de focus. L'écrire ici ne ferait que
    // laisser croire qu'il vaut autre chose.
    fontFamily: "inherit", // sans quoi textarea et champ date passent en monospace
  });
  // Balise : un <label> autour de boutons transmet le clic sur le texte au
  // premier bouton — soit, pour « Format », un basculement à « physique ».
  const ligneEdition = (label, cle, controle, aide, Balise = "label") => (
    <Balise style={{ display: "block", marginBottom: 10 }}>
      <span style={{ display: "block", color: mut, fontSize: "var(--t-legende)", marginBottom: 4 }}>
        {label}{aide ? <span style={{ opacity: 0.75 }}> · {aide}</span> : null}
      </span>
      {controle}
      {erreurs[cle] && <span style={{ display: "block", color: danger, fontSize: "var(--t-legende)", marginTop: 3 }}>⚠️ {erreurs[cle]}</span>}
    </Balise>
  );

  const acc = (id, title, content) => (
    // Un filet suffit à séparer : encadrer chaque section donnait six
    // rectangles de poids identique, et donc aucune hiérarchie.
    <div>
      <button onClick={() => toggle(id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", boxSizing: "border-box", background: "transparent", border: "none", borderTop: `1px solid ${bdr}`, minHeight: "var(--tap-min)", padding: "13px 2px", color: txt, fontSize: "var(--t-petit)", fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
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
            <span style={{ background: PLATFORM_COLORS[g.platform] || accentFond, color: "#fff", fontSize: "var(--t-legende)", fontWeight: 700, borderRadius: "var(--r-xs)", padding: "1px 5px" }}>{g.platform}</span>
            {/* Sur PC, « démat » ne dit rien : ils le sont tous. La pastille
                porte donc la boutique, qui est ce qui distingue un jeu d'un
                autre — et reste muette tant qu'aucune n'est renseignée. */}
            {g.platform === PC
              ? (g.boutique ? <span style={{ background: demat, color: accent, fontSize: "var(--t-legende)", borderRadius: "var(--r-xs)", padding: "1px 5px" }}>{g.boutique}</span> : null)
              : g.format === "démat" && <span style={{ background: demat, color: accent, fontSize: "var(--t-legende)", borderRadius: "var(--r-xs)", padding: "1px 5px" }}>démat</span>}
            {BACK_COMPAT_PARENT[g.platform] && g.backCompat && <span title={`Rétrocompatible ${BACK_COMPAT_PARENT[g.platform]}`} style={{ background: "#107C1022", color: ok, fontSize: "var(--t-legende)", borderRadius: "var(--r-xs)", padding: "1px 5px" }}>🔄 Compatible {BACK_COMPAT_PARENT[g.platform].replace("Xbox ", "")}</span>}
            {g.lentA && <span key={g.lentA} style={{ background: "#7c320044", color: warn, fontSize: "var(--t-legende)", borderRadius: "var(--r-xs)", padding: "1px 5px", animation: "statusPop 200ms ease" }}>📤 {g.lentA}{jours !== null ? ` · ${jours}j` : ""}</span>}
            {/* Rien d'autre ici : les badges disent l'exemplaire, pas le contenu. */}
          </div>
          <div style={{ fontWeight: 600, fontSize: "var(--t-corps)", color: txt, marginBottom: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{g.title}</div>
          {/* Le titre laissait un grand vide à sa droite ; la note, le genre et
              la date d'ajout le remplissent, et la liste se lit sans déplier. */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", overflow: "hidden", whiteSpace: "nowrap", fontSize: "var(--t-legende)", color: mut }}>
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
              <div style={{ fontSize: "var(--t-chiffre)", fontWeight: 700, lineHeight: 1.25, color: txt, marginBottom: 6 }}>{g.title}</div>
              <div style={{ color: mut, fontSize: "var(--t-legende)", lineHeight: 1.7 }}>
                <b style={{ color: txt, fontWeight: 600 }}>{g.platform}</b>{g.platform === PC ? (g.boutique ? ` · ${g.boutique}` : "") : ` · ${g.format}`}
                {g.genre.length > 0 && <><br />{g.genre.join(" · ")}</>}
                {g.metacritic
                  ? <><br />Metacritic <b style={{ color: noteCouleur, fontWeight: 700 }}>{g.metacritic}</b></>
                  /* Un jeu de 1994 n'a pas de Metascore : Metacritic n'existait
                     pas. Le dire vaut mieux qu'une ligne absente, qui se lit
                     comme un oubli et fait relancer la recherche. */
                  : g.noteAbsente ? <><br />Pas de note connue</> : null}
                <br />Ajouté le {new Date(g.addedDate).toLocaleDateString("fr-FR")}

              </div>

              {/* Le même jeu, ailleurs. Rien n'est stocké : deux titres
                  identiques une fois normalisés sont le même jeu, et la
                  mention disparaît d'elle-même si l'autre fiche part.

                  Une pastille et non un lien au fil du texte : un lien pris
                  dans une phrase échappe à la règle des 44 px — le document le
                  dit — mais 14 px de haut ne se visent pas au doigt, et il
                  s'agit ici d'aller ouvrir une autre fiche, pas de lire. */}
              {autres.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <span style={{ color: mut, fontSize: "var(--t-legende)" }}>Aussi sur</span>
                  {autres.map(e => (
                    <button key={e.id} onClick={() => onAutreEdition?.(e)}
                      title="Ouvrir cette version"
                      style={{
                        minHeight: "var(--tap-min)", padding: "0 10px",
                        background: accentDoux, border: `1px solid ${accent}`, color: accent,
                        borderRadius: "var(--r-sm)", fontSize: "var(--t-legende)", fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit",
                      }}>{libelleEdition(e)}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {g.style && (
            <div style={{ marginBottom: 16 }}>
              {/* En italique gris coupé à deux lignes, le seul texte qu'on ait
                  envie de lire était le plus pénible de la fiche. */}
              <div style={{ color: txt, fontSize: "var(--t-corps)", lineHeight: 1.5, ...(descOpen ? {} : { overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical" }) }}>{g.style}</div>
              {/* 20 px de haut : le seul bouton de la fiche à ne jamais avoir
                  reçu de hauteur de cible. Le rembourrage la pose sans
                  déplacer le texte, qui reste aligné sur la description. */}
              {g.style.length > 160 && <button onClick={() => setDescOpen(o => !o)} style={{ background: "transparent", border: "none", color: accent, fontSize: "var(--t-legende)", cursor: "pointer", minHeight: "var(--tap-min)", padding: "6px 12px 6px 0", fontFamily: "inherit" }}>{descOpen ? "▴ Réduire" : "▾ Lire la suite"}</button>}
            </div>
          )}

          {/* Infos Wikidata : des filets, plus un cadre (voir InfoboxView).

              Sans infobox, la section disparaissait sans un mot : la fiche
              paraissait complète, et le seul chemin pour en ajouter une était
              enterré sous « Modifier la fiche » derrière une étiquette qui ne
              la nommait pas. Le manque se dit maintenant à sa place, et le
              bouton ouvre directement la recherche. */}
          {g.infobox ? (
            <div style={{ marginBottom: 16 }}>
              <InfoboxView info={g.infobox} onSerie={onSerie} />
              {/* Deux sources remplissent ces lignes et ne décrivent pas la
                  même chose : la date que RAWG donne est celle de l'édition
                  possédée, celle de Wikidata celle du jeu d'origine. Sans cette
                  ligne, dans six mois, rien ne dit laquelle on lit. */}
              {/* Sans opacité : à 12 px, `mut` atténué de 20 % tombait à 3,34:1
                  sur le fond clair, sous les 4,5:1 exigés. La discrétion se
                  paie en taille et en couleur, pas en transparence. */}
              <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 6 }}>
                Source : {libelleSources(g.infobox)}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
              <span style={{ color: mut, fontSize: "var(--t-legende)" }}>Aucune fiche détaillée</span>
              <button onClick={() => { setWikiOpen(true); setWikiQ(g.title); setWikiDone(false); wikiQuery(g.title); }}
                style={{ minHeight: "var(--tap-min)", padding: "0 10px", background: "transparent", border: `1px solid ${bdr}`, color: accent, borderRadius: "var(--r-sm)", fontSize: "var(--t-legende)", cursor: "pointer", fontFamily: "inherit" }}>
                📚 Chercher sur Wikipédia
              </button>
            </div>
          )}

          {/* Le prêt, et lui seul. Le format et la rétrocompatibilité tenaient
              ici la même place, alors qu'on les règle une fois dans la vie d'un
              jeu : ils sont passés dans « Modifier la fiche », avec le reste de
              ce qui se corrige. Les pastilles en haut de la carte continuent de
              les annoncer d'un coup d'œil.

              Le prêt reste : c'est une action, répétée, et il était auparavant
              enfermé dans un accordéon où « rendu » se devinait en vidant le
              champ du nom.

              Sauf sur PC : un jeu attaché à un compte ne part chez personne.
              L'onglet « Prêts » disparaît déjà de cet univers, ce bloc devait
              suivre — sinon la fiche proposait un geste impossible. */}
          {g.platform !== PC && (
          <div style={{ background: bg, borderRadius: "var(--r-md)", padding: 12, marginBottom: 4 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: mut, fontSize: "var(--t-legende)", flex: "0 0 52px", paddingTop: 10 }}>Prêt</span>
              {g.lentA ? (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: warn, fontSize: "var(--t-petit)", fontWeight: 600, paddingTop: 2 }}>📤 Prêté à {g.lentA}</div>
                  <div style={{ color: warn, fontSize: "var(--t-legende)", margin: "2px 0 8px" }}>
                    Depuis le {new Date(g.lentDate).toLocaleDateString("fr-FR")}
                    {jours !== null ? ` · ${jours} jour${jours > 1 ? "s" : ""}` : ""}
                    {enRetard ? " ⚠️" : ""}
                    {g.lentRetourPrevu && <><br />À rendre le {new Date(g.lentRetourPrevu).toLocaleDateString("fr-FR")}</>}
                  </div>
                  <div style={{ display: "flex", gap: "var(--ecart-tap)", flexWrap: "wrap" }}>
                    <button onClick={() => { onEnrich(g.id, rendreJeu(g)); setLoanName(""); setLoanRetour(""); }}
                      style={{ minHeight: "var(--tap-min)", padding: "0 14px", background: okDoux, border: `1px solid ${ok}`, color: ok, borderRadius: "var(--r-sm)", fontSize: "var(--t-petit)", fontWeight: 600, cursor: "pointer" }}>✓ Rendu</button>
                    <a href={`sms:?body=${encodeURIComponent(`Salut ! Tu penses à me rendre ${g.title} ? 😊`)}`}
                      style={{ minHeight: "var(--tap-min)", padding: "0 14px", display: "inline-flex", alignItems: "center", background: "transparent", border: `1px solid ${bdr}`, color: txt, borderRadius: "var(--r-sm)", fontSize: "var(--t-petit)", textDecoration: "none" }}>Relancer par SMS</a>
                    {/* « Rendu » archive et nourrit les statistiques ; un prêt
                        saisi par erreur doit pouvoir disparaître sans y entrer. */}
                    <button onClick={() => {
                        if (!window.confirm(`Supprimer ce prêt à ${g.lentA} ?\n\nIl ne sera pas enregistré dans l'historique — à utiliser si le prêt n'a jamais eu lieu.`)) return;
                        onEnrich(g.id, annulerPret(g)); setLoanName(""); setLoanRetour("");
                      }}
                      style={{ minHeight: "var(--tap-min)", padding: "0 12px", background: "transparent", border: "none", color: danger, fontSize: "var(--t-petit)", cursor: "pointer", opacity: 0.85 }}>Supprimer</button>
                  </div>
                </div>
              ) : pretOuvert ? (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", color: mut, fontSize: "var(--t-legende)", marginBottom: 4 }}>Prêté à</span>
                  <div style={{ display: "flex", gap: "var(--ecart-tap)" }}>
                    <input value={loanName} onChange={e => setLoanName(e.target.value)} placeholder="Nom…" autoFocus
                      aria-label="Nom de la personne à qui prêter ce jeu"
                      style={{ flex: 1, minWidth: 0, minHeight: "var(--tap-min)", background: "transparent", border: `1px solid ${bdrChamp}`, borderRadius: "var(--r-sm)", color: txt, padding: "0 10px", fontFamily: "inherit" }} />
                    <button onClick={() => { const j = preterJeu(g, loanName, loanRetour); if (j === g) return; onEnrich(g.id, j); setPretOuvert(false); setLoanRetour(""); }}
                      disabled={!loanName.trim()}
                      style={{ minHeight: "var(--tap-min)", padding: "0 14px", background: loanName.trim() ? warnDoux : "transparent", border: `1px solid ${loanName.trim() ? warn : bdr}`, color: loanName.trim() ? warn : mut, borderRadius: "var(--r-sm)", fontSize: "var(--t-petit)", fontWeight: 600, cursor: loanName.trim() ? "pointer" : "default" }}>Prêter</button>
                  </div>
                  {/* Facultatif : sans date, le seuil de 30 jours reste le repli. */}
                  <label style={{ display: "flex", gap: "var(--ecart-tap)", alignItems: "center", marginTop: "var(--ecart-tap)" }}>
                    <span style={{ color: mut, fontSize: "var(--t-legende)", flexShrink: 0 }}>À rendre le</span>
                    <input type="date" value={loanRetour} onChange={e => setLoanRetour(e.target.value)}
                      style={{ flex: 1, minWidth: 0, minHeight: "var(--tap-min)", background: "transparent", border: `1px solid ${bdrChamp}`, borderRadius: "var(--r-sm)", color: txt, padding: "0 8px", fontFamily: "inherit" }} />
                  </label>
                </div>
              ) : (
                <button onClick={() => setPretOuvert(true)}
                  style={{ minHeight: "var(--tap-min)", padding: "0 14px", background: "transparent", border: `1px solid ${bdrChamp}`, color: txt, borderRadius: "var(--r-sm)", fontSize: "var(--t-petit)", cursor: "pointer" }}>📤 Prêter ce jeu</button>
              )}
            </div>
          </div>
          )}

          {/* Ce jeu a-t-il déjà voyagé ? La question que « Rendu » effaçait. */}
          {g.platform !== PC && g.pretsPasses?.length > 0 && (
            <div style={{ color: mut, fontSize: "var(--t-legende)", lineHeight: 1.6, padding: "10px 2px 2px" }}>
              Déjà prêté {g.pretsPasses.length} fois : {g.pretsPasses.map(e => `${e.a} (${dureeEntreeHistorique(e)} j)`).join(" · ")}
            </div>
          )}

          {/* Liens & contenu (accordéon) */}
          {acc("links", "🔗 Liens & contenu", (
            <>
              <div style={{ display: "flex", gap: "var(--ecart-tap)", flexWrap: "wrap", marginBottom: 8 }}>
                <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(g.title + " official trailer")}`} target="_blank" rel="noreferrer" style={{ background: dangerDoux, border: `1px solid ${danger}`, color: danger, borderRadius: "var(--r-xs)", padding: "3px 8px", fontSize: "var(--t-legende)", textDecoration: "none" }}>▶ Trailer</a>
                <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(g.title + " gameplay français")}`} target="_blank" rel="noreferrer" style={{ background: dangerDoux, border: `1px solid ${danger}`, color: danger, borderRadius: "var(--r-xs)", padding: "3px 8px", fontSize: "var(--t-legende)", textDecoration: "none" }}>▶ Gameplay FR</a>
                <a href={`https://www.jeuxvideo.com/recherche/?q=${encodeURIComponent(g.title)}`} target="_blank" rel="noreferrer" style={{ background: accentDoux, border: `1px solid ${accent}`, color: accent, borderRadius: "var(--r-xs)", padding: "3px 8px", fontSize: "var(--t-legende)", textDecoration: "none" }}>JVC</a>
                <a href={`https://www.ign.com/search?q=${encodeURIComponent(g.title)}`} target="_blank" rel="noreferrer" style={{ background: accentDoux, border: `1px solid ${accent}`, color: accent, borderRadius: "var(--r-xs)", padding: "3px 8px", fontSize: "var(--t-legende)", textDecoration: "none" }}>IGN</a>
              </div>
              {[0,1,2].map(i => (
                <label key={i} style={{ display: "block", marginBottom: 6 }}>
                  <span style={{ display: "block", color: mut, fontSize: "var(--t-legende)", marginBottom: 2 }}>{["Soluce","Wiki","Ma playlist YouTube"][i]}</span>
                  <input value={g.myLinks[i] || ""} onChange={e => { const l = [...g.myLinks]; l[i] = e.target.value; onEdit(g.id, "myLinks", l); }}
                    placeholder="https://…"
                    style={{ display: "block", width: "100%", minHeight: "var(--tap-min)", background: "transparent", border: `1px solid ${bdrChamp}`, borderRadius: "var(--r-sm)", color: txt, padding: "0 8px", fontFamily: "inherit", boxSizing: "border-box" }} />
                </label>
              ))}
              {/* Le filtrage a lieu à l'import ; il a lieu ici aussi. Une
                  bibliothèque enregistrée avant ce filtre peut encore contenir
                  un lien qui n'en est pas un, et c'est ici qu'il deviendrait
                  cliquable. Il reste affiché, en texte : cacher la valeur
                  empêcherait de comprendre pourquoi le lien ne fonctionne
                  plus. */}
              {g.myLinks.filter(Boolean).map((url, i) => {
                const style = { display: "block", fontSize: "var(--t-legende)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
                return estLienSur(url)
                  ? <a key={i} href={url} target="_blank" rel="noreferrer" style={{ ...style, color: accent }}>{url}</a>
                  : <span key={i} title="Seuls les liens http:// et https:// sont ouverts" style={{ ...style, color: mut }}>⚠️ {url}</span>;
              })}
            </>
          ))}

          {/* Notes (accordéon) */}
          {acc("notes", "📝 Notes", (
            <>
              <textarea value={g.tips || ""} onChange={e => onEdit(g.id, "tips", e.target.value)} placeholder="Notes & tips perso…" rows={2} style={{ width: "100%", background: "transparent", border: `1px solid ${bdrChamp}`, borderRadius: "var(--r-sm)", color: txt, padding: "8px", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
              {/* La recherche interrogeait déjà `g.tag`, mais rien ne permettait
                  de l'écrire : chercher par tag ne pouvait par construction rien
                  trouver. */}
              <div style={{ display: "flex", gap: "var(--ecart-tap)", alignItems: "center", marginTop: 6 }}>
                <span style={{ color: mut, fontSize: "var(--t-legende)", flexShrink: 0 }}>Tag :</span>
                <input value={g.tag || ""} onChange={e => onEdit(g.id, "tag", e.target.value)}
                  placeholder="coop, à revendre, prêt à Paul…"
                  aria-label="Tag libre, utilisable dans la recherche"
                  style={{ flex: 1, minWidth: 0, minHeight: "var(--tap-min)", background: "transparent", border: `1px solid ${bdrChamp}`, borderRadius: "var(--r-sm)", color: txt, padding: "0 8px", fontFamily: "inherit" }} />
              </div>
            </>
          ))}
          {/* Re-association RAWG */}
          {rawgOpen && (
            <Sheet title="Ré-associer depuis RAWG" onClose={() => setRawgOpen(false)}>
              <input value={rawgQ} onChange={e => rawgQuery(e.target.value)} placeholder="Titre du jeu…" autoFocus style={champRecherche} />
              {rawgBusy && <div style={{ color: accent, fontSize: "var(--t-legende)", marginTop: 4 }}>Récupération & traduction…</div>}
              {rawgSugg.length > 0 && !rawgBusy && (
                <div style={{ marginTop: 6, background: card, border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", maxHeight: 300, overflowY: "auto", boxShadow: "0 8px 24px #0008" }}>
                  {rawgSugg.map(s => (
                    <button key={s.id} type="button" className="gl-row" onClick={() => rawgPick(s)} style={ligneChoix}>
                      {s.background_image && <img src={s.background_image} alt="" style={{ width: 34, height: 51, minWidth: 34, objectFit: "cover", borderRadius: "var(--r-xs)" }} />}
                      <span style={{ minWidth: 0, textAlign: "left" }}><span style={{ display: "block", color: txt, fontSize: "var(--t-petit)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span><span style={{ display: "block", color: mut, fontSize: "var(--t-legende)" }}>{s.released}{s.metacritic ? ` · MC ${s.metacritic}` : ""}</span></span>
                    </button>
                  ))}
                </div>
              )}
            </Sheet>
          )}
          {/* Wikipédia FR : le titre, et tout ce que la page rapporte avec lui.
              La feuille s'appelait « Titre français », le bouton aussi : ils
              n'annonçaient qu'un quart de ce qu'ils rapportent — le résumé, la
              jaquette et les infos Wikidata arrivent par le même chemin, et
              rien ailleurs dans l'application ne mène à ces dernières. */}
          {wikiOpen && (
            <Sheet title="Compléter depuis Wikipédia" onClose={() => setWikiOpen(false)}>
              <input value={wikiQ} onChange={e => wikiQuery(e.target.value)} placeholder="Titre du jeu…" autoFocus style={champRecherche} />
              {wikiBusy && <div style={{ color: accent, fontSize: "var(--t-legende)", marginTop: 4 }}>Recherche…</div>}
              {!wikiBusy && wikiSugg.length > 0 && (
                <div style={{ marginTop: 6, background: card, border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", maxHeight: 300, overflowY: "auto", boxShadow: "0 8px 24px #0008" }}>
                  {wikiSugg.map((s, i) => (
                    <div key={i} className="gl-row" style={{ display: "flex", gap: 8, padding: "7px 9px", borderBottom: `1px solid ${bdr}`, alignItems: "center" }}>
                      <button type="button" onClick={() => wikiPick(s.title)} style={{ ...ligneChoix, flex: 1, borderBottom: "none", padding: "0 0 0 0", color: txt, fontSize: "var(--t-petit)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", textAlign: "left" }}>{s.title}</button>
                      {s.url && <a href={s.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} title="Voir la page Wikipédia" style={{ color: accent, fontSize: "var(--t-legende)", textDecoration: "none", flexShrink: 0 }}>↗ page</a>}
                    </div>
                  ))}
                </div>
              )}
              {!wikiBusy && wikiDone && wikiSugg.length === 0 && !wikiPicked && <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 6 }}>Aucun titre français trouvé</div>}

              {wikiFetching && <div style={{ color: accent, fontSize: "var(--t-legende)", marginTop: 8 }}>Chargement de la fiche Wikipédia…</div>}

              {/* Résumé Wikipédia */}
              {wikiExtract && (
                <div style={{ marginTop: 10, borderTop: `1px solid ${bdr}`, paddingTop: 8 }}>
                  <div style={{ color: txt, fontSize: "var(--t-legende)", fontWeight: 600, marginBottom: 4 }}>Résumé Wikipédia</div>
                  <div style={{ color: mut, fontSize: "var(--t-legende)", fontStyle: "italic", lineHeight: 1.4, maxHeight: 96, overflowY: "auto", marginBottom: 6 }}>{wikiExtract}</div>
                  <div style={{ display: "flex", gap: "var(--ecart-tap)", flexWrap: "wrap" }}>
                    <button onClick={() => { onEdit(g.id, "style", wikiExtract); setWikiExtract(null); }} style={{ background: okDoux, border: `1px solid ${ok}`, color: ok, borderRadius: "var(--r-sm)", padding: "0 10px", minHeight: "var(--tap-min)", fontSize: "var(--t-legende)", cursor: "pointer" }}>Utiliser ce résumé</button>
                    <button onClick={() => setWikiExtract(null)} style={{ background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: "var(--r-sm)", padding: "0 10px", minHeight: "var(--tap-min)", fontSize: "var(--t-legende)", cursor: "pointer" }}>Garder la description actuelle</button>
                  </div>
                </div>
              )}

              {/* Jaquette Wikipédia */}
              {wikiImage && (
                <div style={{ marginTop: 10, borderTop: `1px solid ${bdr}`, paddingTop: 8 }}>
                  <div style={{ color: txt, fontSize: "var(--t-legende)", fontWeight: 600, marginBottom: 4 }}>Jaquette Wikipédia</div>
                  <img src={wikiImage} alt="" style={{ maxWidth: 120, maxHeight: 160, objectFit: "contain", borderRadius: "var(--r-sm)", border: `1px solid ${bdr}`, display: "block", marginBottom: 6 }} />
                  <div style={{ display: "flex", gap: "var(--ecart-tap)", flexWrap: "wrap" }}>
                    <button onClick={() => { onEdit(g.id, "cover", wikiImage); setWikiImage(null); }} style={{ background: okDoux, border: `1px solid ${ok}`, color: ok, borderRadius: "var(--r-sm)", padding: "0 10px", minHeight: "var(--tap-min)", fontSize: "var(--t-legende)", cursor: "pointer" }}>Utiliser cette jaquette</button>
                    <button onClick={() => setWikiImage(null)} style={{ background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: "var(--r-sm)", padding: "0 10px", minHeight: "var(--tap-min)", fontSize: "var(--t-legende)", cursor: "pointer" }}>Garder la jaquette actuelle</button>
                  </div>
                </div>
              )}

              {/* Infos Wikidata */}
              {wikiInfo && (
                <div style={{ marginTop: 10, borderTop: `1px solid ${bdr}`, paddingTop: 8 }}>
                  <div style={{ color: txt, fontSize: "var(--t-legende)", fontWeight: 600, marginBottom: 4 }}>ℹ️ Infos (Wikidata)</div>
                  <div style={{ marginBottom: 6 }}><InfoboxView info={wikiInfo} /></div>
                  <div style={{ display: "flex", gap: "var(--ecart-tap)", flexWrap: "wrap" }}>
                    <button onClick={() => { onEdit(g.id, "infobox", fusionnerInfobox(g.infobox, wikiInfo, "wikidata")); setWikiInfo(null); }} style={{ background: okDoux, border: `1px solid ${ok}`, color: ok, borderRadius: "var(--r-sm)", padding: "0 10px", minHeight: "var(--tap-min)", fontSize: "var(--t-legende)", cursor: "pointer" }}>Compléter avec ces infos</button>
                    <button onClick={() => setWikiInfo(null)} style={{ background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: "var(--r-sm)", padding: "0 10px", minHeight: "var(--tap-min)", fontSize: "var(--t-legende)", cursor: "pointer" }}>Ignorer</button>
                  </div>
                </div>
              )}
            </Sheet>
          )}
          {/* Vider la fiche.
              Cinq cases plutôt qu'un bouton unique : « repartir propre » ne veut
              pas dire la même chose selon qu'une infobox est fausse ou qu'une
              jaquette l'est, et tout effacer d'un geste ferait perdre ce qui
              était bon. Ce qui est déjà vide reste décoché et inerte — le
              proposer laisserait croire qu'il y a là quelque chose à enlever. */}
          {videOpen && (
            <Sheet title="Vider la fiche" onClose={() => setVideOpen(false)}>
              <div style={{ color: mut, fontSize: "var(--t-legende)", lineHeight: 1.5, marginBottom: 10 }}>
                Ce qui est effacé peut être retrouvé en repassant les sources, mais rien ne le
                remettra à l'identique. Les prêts, les notes personnelles et les liens ne sont pas
                touchés.
              </div>
              {CHAMPS_VIDABLES.map(([cle, libelle]) => {
                const vide = jeuACompleter(g, cle);
                const coche = videChoix.includes(cle);
                return (
                  <label key={cle} style={{
                    display: "flex", alignItems: "center", gap: 10, minHeight: "var(--tap)",
                    padding: "0 4px", borderBottom: `1px solid ${bdr}`,
                    cursor: vide ? "default" : "pointer", opacity: vide ? 0.45 : 1,
                  }}>
                    <input type="checkbox" checked={coche} disabled={vide}
                      onChange={() => { setVideRien(false); setVideChoix(c => (coche ? c.filter(x => x !== cle) : [...c, cle])); }}
                      style={{ width: 20, height: 20, accentColor: accentFond, flexShrink: 0 }} />
                    <span style={{ color: txt, fontSize: "var(--t-corps)", flex: 1 }}>{libelle}</span>
                    {vide && <span style={{ color: mut, fontSize: "var(--t-legende)" }}>déjà vide</span>}
                  </label>
                );
              })}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button onClick={() => setVideOpen(false)}
                  style={{ flex: 1, minHeight: "var(--tap)", background: "transparent", border: `1px solid ${bdr}`, color: txt, borderRadius: "var(--r-sm)", fontSize: "var(--t-corps)", cursor: "pointer", fontFamily: "inherit" }}>
                  Annuler
                </button>
                {/* À parts égales, et pas deux tiers pour l'effacement : la
                    place d'un bouton dit son importance, et inviter le pouce
                    vers l'action irréversible est un mauvais conseil.

                    Actif même sans case cochée. Un bouton grisé et muet
                    laisse chercher ce qui manque ; celui-ci le dit. */}
                <button
                  onClick={() => {
                    if (!videChoix.length) { setVideRien(true); return; }
                    const noms = CHAMPS_VIDABLES.filter(([c]) => videChoix.includes(c)).map(([, l]) => l).join(", ");
                    if (!window.confirm(`Effacer de « ${g.title} » : ${noms} ?`)) return;
                    onEnrich(g.id, viderChamps(g, videChoix));
                    setVideOpen(false);
                  }}
                  style={{ flex: 1, minHeight: "var(--tap)", background: videChoix.length ? dangerDoux : "transparent", border: `1px solid ${danger}`, color: danger, borderRadius: "var(--r-sm)", fontSize: "var(--t-corps)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Vider
                </button>
              </div>
              {videRien && (
                <div role="alert" style={{ color: danger, fontSize: "var(--t-legende)", marginTop: 8 }}>
                  ⚠️ Coche au moins un champ à effacer.
                </div>
              )}
            </Sheet>
          )}

          {/* Jaquettes SteamGridDB */}
          {sgdbOpen && (
            <Sheet title="Choisir une jaquette" onClose={() => setSgdbOpen(false)}>
              <input value={sgdbQ} onChange={e => sgdbQuery(e.target.value)} placeholder="Titre du jeu…" autoFocus style={champRecherche} />
              {sgdbBusy && <div style={{ color: accent, fontSize: "var(--t-legende)", marginTop: 6 }}>Recherche des jaquettes…</div>}
              {!sgdbBusy && sgdbGridsList.length > 0 && (
                <>
                  {sgdbMatch && <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 6 }}>Trouvé : <span style={{ color: txt, fontWeight: 600 }}>{sgdbMatch}</span></div>}
                  <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                    {sgdbGridsList.map((grid, i) => (
                      <button key={i} type="button" className="gl-thumb" onClick={() => sgdbPick(grid.url)}
                        aria-label={`Utiliser cette jaquette (${i + 1})`}
                        style={{ padding: 0, background: "transparent", border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", cursor: "pointer", display: "block", overflow: "hidden" }}>
                        <img src={grid.thumb} alt="" loading="lazy"
                          style={{ width: "100%", aspectRatio: "2 / 3", objectFit: "cover", display: "block" }} />
                      </button>
                    ))}
                  </div>
                </>
              )}
              {!sgdbBusy && sgdbDone && sgdbGridsList.length === 0 && <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 6 }}>Aucune jaquette trouvée sur SteamGridDB</div>}
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
              style={{ minHeight: "var(--tap-min)", padding: "0 14px", background: sourcesOuvertes ? accentDoux : "transparent", border: `1px solid ${sourcesOuvertes ? accent : bdrChamp}`, color: sourcesOuvertes ? accent : mut, borderRadius: "var(--r-sm)", fontSize: "var(--t-petit)", cursor: "pointer" }}>
              ⋯ Modifier la fiche
            </button>
            <button onClick={() => onDelete(g)}
              style={{ marginLeft: "auto", minHeight: "var(--tap-min)", padding: "0 10px", background: "transparent", border: "none", color: danger, fontSize: "var(--t-petit)", cursor: "pointer", opacity: 0.85 }}>
              Supprimer
            </button>
          </div>

          {sourcesOuvertes && (
            <div style={{ display: "flex", gap: "var(--ecart-tap)", flexWrap: "wrap", marginTop: 10 }}>
              <button onClick={() => { setSourcesOuvertes(false); ouvrirEdition(); }}
                style={{ ...boutonSource, background: accentDoux, fontWeight: 600 }}>✏️ À la main</button>
              <button onClick={() => { setSourcesOuvertes(false); setRawgOpen(true); setRawgQ(g.title); rawgQuery(g.title); }} style={boutonSource}>🔄 RAWG</button>
              <button onClick={() => { setSourcesOuvertes(false); setWikiOpen(true); setWikiQ(g.title); setWikiDone(false); wikiQuery(g.title); }} style={boutonSource}>📚 Wikipédia</button>
              <button onClick={() => { setSourcesOuvertes(false); setSgdbOpen(true); setSgdbQ(g.title); setSgdbDone(false); sgdbQuery(g.title); }} style={boutonSource}>📦 Jaquette</button>
              {/* Puisque les sources ne s'écrasent plus, il faut de quoi
                  repartir propre : sans ce bouton, une infobox fausse le
                  resterait, chaque nouvelle source la respectant poliment. */}
              <button onClick={() => { setSourcesOuvertes(false); setVideChoix([]); setVideRien(false); setVideOpen(true); }}
                style={{ ...boutonSource, borderColor: bdrChamp, color: mut }}>🧹 Vider</button>
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

              {/* Un jeu PC est toujours démat : le choix disparaît plutôt que
                  de proposer une réponse que le modèle refusera. Ce qui le
                  distingue, c'est la boutique, et elle prend sa place. */}
              {brouillon.platform === PC
                ? ligneEdition("Boutique", "boutique", (
                    <input value={brouillon.boutique} onChange={e => champ("boutique", e.target.value)}
                      placeholder="Steam, Epic, GOG…" style={champStyle("boutique")} />
                  ), "démat, forcément")
                : ligneEdition("Format", "format", (
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

              <div style={{ color: mut, fontSize: "var(--t-legende)", fontWeight: 600, margin: "14px 0 8px", paddingTop: 10, borderTop: `1px solid ${bdr}` }}>Fiche détaillée</div>
              {ligneEdition("Développeur", "developers", <input value={brouillon.developers} onChange={e => champ("developers", e.target.value)} style={champStyle("developers")} />, "séparés par des virgules")}
              {ligneEdition("Éditeur", "publishers", <input value={brouillon.publishers} onChange={e => champ("publishers", e.target.value)} style={champStyle("publishers")} />, "séparés par des virgules")}
              {ligneEdition("Sorties", "releases", <textarea value={brouillon.releases} onChange={e => champ("releases", e.target.value)} rows={3} placeholder={"2020-11-10 (Xbox Series X)"} style={{ ...champStyle("releases"), resize: "vertical" }} />, "une par ligne")}
              {ligneEdition("Mode", "modes", <input value={brouillon.modes} onChange={e => champ("modes", e.target.value)} placeholder="Solo, Multijoueur…" style={champStyle("modes")} />, "séparés par des virgules")}
              {ligneEdition("Série", "series", <input value={brouillon.series} onChange={e => champ("series", e.target.value)} style={champStyle("series")} />)}
              {ligneEdition("Épisode précédent", "follows", <input value={brouillon.follows} onChange={e => champ("follows", e.target.value)} style={champStyle("follows")} />)}
              {ligneEdition("Épisode suivant", "followedBy", <input value={brouillon.followedBy} onChange={e => champ("followedBy", e.target.value)} style={champStyle("followedBy")} />)}

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button onClick={enregistrer} style={{ minHeight: "var(--tap)", padding: "0 16px", background: accentFond, border: "1px solid transparent", color: "#fff", borderRadius: "var(--r-sm)", fontSize: "var(--t-petit)", fontWeight: 600, cursor: "pointer" }}>Enregistrer</button>
                <button onClick={fermerEdition} style={{ minHeight: "var(--tap)", padding: "0 14px", background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: "var(--r-sm)", fontSize: "var(--t-petit)", cursor: "pointer" }}>Annuler</button>
              </div>
              {/* Le champ fautif peut être remonté hors de l'écran au moment
                  où on appuie sur Enregistrer : sans ce rappel, le bouton
                  paraît sans effet. */}
              {Object.keys(erreurs).length > 0 && (
                <div role="alert" style={{ color: danger, fontSize: "var(--t-legende)", marginTop: 8 }}>⚠️ Rien n'a été enregistré : {Object.keys(erreurs).length} champ{Object.keys(erreurs).length > 1 ? "s sont signalés" : " est signalé"} plus haut, avec l'explication sous chacun.</div>
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
