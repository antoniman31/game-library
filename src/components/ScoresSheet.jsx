import Sheet from "./Sheet.jsx";
import { bdr, txt, mut, ok, warn, danger } from "../lib/theme.js";
import { rapprochementDouteux } from "../lib/model.js";

// Bilan de « Compléter les scores manquants ».
//
// Le score est pris sur le premier résultat RAWG pour le titre : sur une
// centaine de jeux, un titre approximatif finit par ramener la note d'un autre
// jeu. Plutôt qu'écrire en silence, l'opération rend des comptes — quel titre
// RAWG a répondu pour quel jeu — et laisse retirer une note à côté de la
// plaque. Les rapprochements dont les titres ne se recouvrent pas sont
// signalés d'office.
export default function ScoresSheet({ bilan, onAnnulerScore, onClose }) {
  const { trouves, sansScore, stopped } = bilan;
  const douteux = trouves.filter(t => rapprochementDouteux(t.titre, t.titreRawg)).length;

  return (
    <Sheet title="Scores complétés" onClose={onClose}>
      <div style={{ color: txt, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        {stopped ? "Interrompu — " : ""}{trouves.length} score{trouves.length > 1 ? "s" : ""} récupéré{trouves.length > 1 ? "s" : ""}
      </div>
      <div style={{ color: mut, fontSize: 11, marginBottom: 12, lineHeight: 1.5 }}>
        {sansScore.length > 0 && <>{sansScore.length} jeu{sansScore.length > 1 ? "x" : ""} sans note sur RAWG.<br /></>}
        {douteux > 0
          ? `${douteux} rapprochement${douteux > 1 ? "s" : ""} à vérifier — en orange ci-dessous.`
          : trouves.length > 0 ? "Tous les titres correspondent." : null}
      </div>

      {trouves.map(t => {
        const suspect = rapprochementDouteux(t.titre, t.titreRawg);
        return (
          <div key={t.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 0", borderTop: `1px solid ${bdr}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: txt, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.titre}</div>
              <div style={{ color: suspect ? warn : mut, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {suspect ? "⚠️ " : ""}RAWG : {t.titreRawg}
              </div>
            </div>
            <span style={{ color: t.score >= 80 ? ok : t.score >= 60 ? warn : danger, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{t.score}</span>
            <button onClick={() => onAnnulerScore(t.id)} title="Retirer ce score"
              style={{ flexShrink: 0, minHeight: 34, padding: "0 10px", background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
              Retirer
            </button>
          </div>
        );
      })}

      {sansScore.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${bdr}` }}>
          <div style={{ color: mut, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Sans note sur RAWG</div>
          <div style={{ color: mut, fontSize: 11, lineHeight: 1.5 }}>{sansScore.join(" · ")}</div>
        </div>
      )}
    </Sheet>
  );
}
