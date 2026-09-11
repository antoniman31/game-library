import { useState } from "react";
import Sheet from "./Sheet.jsx";
import { bdr, txt, mut, accent, accentFond, ok, warn, danger, bdrChamp } from "../lib/theme.js";
import { rapprochementDouteux } from "../lib/model.js";

// Ce qu'une revérification générale changerait, avant qu'elle ne change rien.
//
// Compléter une note vide ne peut rien abîmer : il n'y avait rien. Rafraîchir
// une note existante, si — la source peut s'être trompée de jeu, et écraserait
// alors une note juste, y compris une note corrigée à la main. Cet écran est le
// prix de cette différence : rien n'est écrit tant qu'on n'a pas regardé.
//
// Les écarts les plus grands d'abord, parce que ce sont les seuls qui demandent
// un jugement — passer de 78 à 79 ne se discute pas, passer de 92 à 61 veut
// dire qu'une source a répondu pour un autre jeu.
const couleurNote = (n) => (n >= 80 ? ok : n >= 60 ? warn : danger);

export default function NotesChoixSheet({ propositions, stopped, onAppliquer, onClose }) {
  const [coches, setCoches] = useState(() => Object.fromEntries(propositions.map(p => [p.id, true])));
  const choisies = propositions.filter(p => coches[p.id]);
  const toutCoche = propositions.length > 0 && choisies.length === propositions.length;

  const rangees = [...propositions].sort((a, b) => {
    const ecart = (p) => (Number.isInteger(p.avant) ? Math.abs(p.apres - p.avant) : -1);
    return ecart(b) - ecart(a);
  });

  return (
    <Sheet title="Notes à mettre à jour" onClose={onClose}>
      <p style={{ color: mut, fontSize: "var(--t-legende)", lineHeight: 1.5, margin: "0 0 12px" }}>
        {stopped ? "Recherche interrompue. " : ""}
        {propositions.length} fiche{propositions.length > 1 ? "s" : ""} dont la note diffère de ce que les
        sources répondent. Les autres n'ont pas bougé. Rien n'est écrit avant que tu valides.
      </p>

      <button
        onClick={() => {
          const v = !toutCoche;
          setCoches(Object.fromEntries(propositions.map(p => [p.id, v])));
        }}
        style={{ background: "transparent", border: `1px solid ${bdrChamp}`, color: mut, borderRadius: "var(--r-xs)", minHeight: "var(--tap-min)", padding: "0 10px", fontSize: "var(--t-legende)", cursor: "pointer", marginBottom: 8 }}
      >
        {toutCoche ? "Tout décocher" : "Tout cocher"}
      </button>

      <div style={{ border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", marginBottom: 12 }}>
        {rangees.map((p, i) => {
          const suspect = rapprochementDouteux(p.titre, p.source);
          return (
            <label key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", minHeight: "var(--tap-min)", padding: "6px 9px", borderBottom: i < rangees.length - 1 ? `1px solid ${bdr}` : "none", cursor: "pointer" }}>
              <input type="checkbox" checked={!!coches[p.id]} aria-label={p.titre}
                onChange={e => setCoches(c => ({ ...c, [p.id]: e.target.checked }))}
                style={{ accentColor: accent, width: 18, height: 18, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: txt, fontSize: "var(--t-petit)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.titre}</div>
                {/* La source est ce qui permet de juger : une note qui chute de
                    trente points avec un titre voisin est un mauvais
                    rapprochement, pas une réévaluation. */}
                <div style={{ color: suspect ? warn : mut, fontSize: "var(--t-legende)", lineHeight: 1.35 }}>
                  {suspect ? "⚠️ " : ""}{p.source}
                </div>
              </div>
              <span style={{ fontSize: "var(--t-petit)", whiteSpace: "nowrap", flexShrink: 0 }}>
                <span style={{ color: mut }}>{Number.isInteger(p.avant) ? p.avant : "—"}</span>
                <span style={{ color: mut }}> → </span>
                <span style={{ color: couleurNote(p.apres), fontWeight: 700 }}>{p.apres}</span>
              </span>
            </label>
          );
        })}
      </div>

      <button onClick={() => onAppliquer(choisies)} disabled={!choisies.length}
        style={{ width: "100%", background: accentFond, border: "none", color: "#fff", borderRadius: "var(--r-sm)", minHeight: "var(--tap)", cursor: choisies.length ? "pointer" : "default", opacity: choisies.length ? 1 : 0.5, fontSize: "var(--t-corps)", fontWeight: 600 }}>
        Appliquer {choisies.length} modification{choisies.length > 1 ? "s" : ""}
      </button>
    </Sheet>
  );
}
