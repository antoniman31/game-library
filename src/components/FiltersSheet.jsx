import { useState } from "react";
import Sheet from "./Sheet.jsx";
import { bdr, txt, mut, accent, accentDoux, accentFond, warn } from "../lib/theme.js";
import { PLATFORMS, compterFiltres } from "../lib/model.js";

const ACCENT = accent;

// Une rangée d'options. `flex: 1` avec `minWidth` laisse deux ou trois boutons
// par ligne selon leur libellé, sans grille figée qui laisserait des trous.
function Groupe({ label, options, value, onChange, colorOf, compact, aide, apres }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ color: mut, fontSize: "var(--t-legende)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 7 }}>
        {label}
      </div>
      {aide && <div style={{ color: mut, fontSize: "var(--t-legende)", lineHeight: 1.4, margin: "-3px 0 7px" }}>{aide}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {options.map(([k, l]) => {
          const actif = value === k;
          const c = (colorOf && colorOf(k)) || ACCENT;
          return (
            <button
              key={k}
              onClick={() => onChange(k)}
              aria-pressed={actif}
              style={{
                flex: compact ? "0 0 auto" : 1, minWidth: compact ? 0 : 92, minHeight: "var(--tap)",
                background: actif ? (c === accent ? accentDoux : c + "22") : "transparent",
                border: `1px solid ${actif ? c : bdr}`,
                color: actif ? c : txt,
                borderRadius: "var(--r-sm)", padding: "6px 10px", fontSize: "var(--t-petit)",
                fontWeight: actif ? 600 : 400, cursor: "pointer",
              }}
            >
              {l}
            </button>
          );
        })}
      </div>
      {apres}
    </div>
  );
}

// Au-delà, la liste des genres cesse d'être un choix et devient un mur : sur
// une bibliothèque réelle, les huit premiers couvrent déjà les cinq sixièmes
// des jeux, et la longue traîne se rejoint mieux par la recherche.
const GENRES_VISIBLES = 8;

export default function FiltersSheet({
  plat, setPlat, pretFil, setPretFil, fmtFil, setFmtFil,
  genreFil, setGenreFil, modeFil, setModeFil, genres, sansMode,
  sort, setSort, view, setView, onClose, resultats,
}) {
  const actifs = compterFiltres({ plat, pretFil, fmtFil, genreFil, modeFil });
  const [tousLesGenres, setTousLesGenres] = useState(false);
  // Le genre choisi reste visible même s'il est dans la traîne : sinon le
  // filtre actif disparaît de l'écran et on ne sait plus comment l'enlever.
  const visibles = tousLesGenres
    ? genres
    : genres.filter(([g], i) => i < GENRES_VISIBLES || g === genreFil);
  const caches = genres.length - visibles.length;
  return (
    <Sheet title="Filtres & affichage" onClose={onClose}>
      <Groupe
        label="Plateforme"
        options={PLATFORMS.map(p => [p, p === "tous" ? "Toutes" : p])}
        value={plat}
        onChange={setPlat}
      />
      {/* Le groupe Statut a laissé la place au seul état que l'application
          suit encore : le jeu est-il ici, ou chez quelqu'un ? */}
      <Groupe
        label="Prêt"
        options={[["tous", "Tous"], ["chez moi", "🏠 Chez moi"], ["prêtés", "📤 Prêtés"]]}
        value={pretFil}
        onChange={setPretFil}
        colorOf={k => (k === "prêtés" ? warn : ACCENT)}
      />
      <Groupe
        label="Format"
        options={[["tous", "Tous"], ["physique", "Physique"], ["démat", "Démat"]]}
        value={fmtFil}
        onChange={setFmtFil}
      />

      {/* « On est deux ce soir, on lance quoi ? » — la question que cent
          cinquante jeux rendent difficile, et à laquelle Wikidata répondait
          déjà sans qu'on puisse le lui demander. */}
      <Groupe
        label="Mode de jeu"
        options={[["tous", "Tous"], ["solo", "Solo"], ["multi", "À plusieurs"], ["coop", "Coopératif"]]}
        value={modeFil}
        onChange={setModeFil}
        aide={sansMode > 0
          ? `D'après la fiche Wikidata. ${sansMode} jeu${sansMode > 1 ? "x n'en ont" : " n'en a"} pas et ne ${sansMode > 1 ? "sortiront" : "sortira"} d'aucun de ces choix.`
          : null}
      />

      {genres.length > 0 && (
        <Groupe
          label="Genre"
          compact
          options={[["tous", "Tous"], ...visibles.map(([g, n]) => [g, `${g} ${n}`])]}
          value={genreFil}
          onChange={setGenreFil}
          apres={caches > 0 && (
            <button
              onClick={() => setTousLesGenres(true)}
              style={{
                minHeight: "var(--tap-min)", marginTop: 8, padding: "0 12px",
                background: "transparent", border: `1px solid ${bdr}`, color: mut,
                borderRadius: "var(--r-sm)", fontSize: "var(--t-legende)",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {caches} genre{caches > 1 ? "s" : ""} de plus
            </button>
          )}
        />
      )}
      <Groupe
        label="Tri"
        options={[["titre", "A → Z"], ["date", "Date"], ["metacritic", "Metacritic"]]}
        value={sort}
        onChange={setSort}
      />
      <Groupe
        label="Affichage"
        options={[["liste", "☰ Liste"], ["grille", "⊞ Grille"]]}
        value={view}
        onChange={setView}
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
        <button
          onClick={() => { setPlat("tous"); setPretFil("tous"); setFmtFil("tous"); setGenreFil("tous"); setModeFil("tous"); }}
          disabled={actifs === 0}
          style={{
            flex: 1, minHeight: "var(--tap)", background: "transparent",
            border: `1px solid ${bdr}`, color: actifs ? txt : mut, borderRadius: "var(--r-sm)",
            fontSize: "var(--t-corps)", cursor: actifs ? "pointer" : "default", opacity: actifs ? 1 : 0.5,
          }}
        >
          Réinitialiser
        </button>
        <button
          onClick={onClose}
          style={{
            flex: 2, minHeight: "var(--tap)", background: accentFond, border: "none",
            color: "#fff", borderRadius: "var(--r-sm)", fontSize: "var(--t-corps)", fontWeight: 600, cursor: "pointer",
          }}
        >
          Voir {resultats} jeu{resultats > 1 ? "x" : ""}
        </button>
      </div>
    </Sheet>
  );
}
