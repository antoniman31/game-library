import Sheet from "./Sheet.jsx";
import { bdr, txt, mut } from "../lib/theme.js";
import { STATUTS, STATUS_COLORS, PLATFORMS, compterFiltres } from "../lib/model.js";

const ACCENT = "#5493FF";

// Une rangée d'options. `flex: 1` avec `minWidth` laisse deux ou trois boutons
// par ligne selon leur libellé, sans grille figée qui laisserait des trous.
function Groupe({ label, options, value, onChange, colorOf }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ color: mut, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 7 }}>
        {label}
      </div>
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
                flex: 1, minWidth: 92, minHeight: "var(--tap)",
                background: actif ? c + "22" : "transparent",
                border: `1px solid ${actif ? c : bdr}`,
                color: actif ? c : txt,
                borderRadius: 8, padding: "6px 10px", fontSize: 12,
                fontWeight: actif ? 600 : 400, cursor: "pointer",
              }}
            >
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function FiltersSheet({
  plat, setPlat, statFil, setStatFil, fmtFil, setFmtFil,
  sort, setSort, view, setView, onClose, resultats,
}) {
  const actifs = compterFiltres({ plat, statFil, fmtFil });
  return (
    <Sheet title="Filtres & affichage" onClose={onClose}>
      <Groupe
        label="Plateforme"
        options={PLATFORMS.map(p => [p, p === "tous" ? "Toutes" : p])}
        value={plat}
        onChange={setPlat}
      />
      <Groupe
        label="Statut"
        options={[["tous", "Tous"], ...STATUTS.map(s => [s, s]), ["à finir", "🎯 À finir"]]}
        value={statFil}
        onChange={setStatFil}
        colorOf={k => STATUS_COLORS[k]}
      />
      <Groupe
        label="Format"
        options={[["tous", "Tous"], ["physique", "Physique"], ["démat", "Démat"]]}
        value={fmtFil}
        onChange={setFmtFil}
      />
      <Groupe
        label="Tri"
        options={[["titre", "A → Z"], ["date", "Date"], ["metacritic", "Metacritic"], ["temps", "Temps de jeu"]]}
        value={sort}
        onChange={setSort}
      />
      <Groupe
        label="Affichage"
        options={[["liste", "☰ Liste"], ["compact", "≡ Compact"], ["grille", "⊞ Grille"]]}
        value={view}
        onChange={setView}
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
        <button
          onClick={() => { setPlat("tous"); setStatFil("tous"); setFmtFil("tous"); }}
          disabled={actifs === 0}
          style={{
            flex: 1, minHeight: "var(--tap)", background: "transparent",
            border: `1px solid ${bdr}`, color: actifs ? txt : mut, borderRadius: 8,
            fontSize: 13, cursor: actifs ? "pointer" : "default", opacity: actifs ? 1 : 0.5,
          }}
        >
          Réinitialiser
        </button>
        <button
          onClick={onClose}
          style={{
            flex: 2, minHeight: "var(--tap)", background: ACCENT, border: "none",
            color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          Voir {resultats} jeu{resultats > 1 ? "x" : ""}
        </button>
      </div>
    </Sheet>
  );
}
