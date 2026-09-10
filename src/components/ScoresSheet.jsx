import Sheet from "./Sheet.jsx";
import { bdr, txt, mut, ok, warn, danger } from "../lib/theme.js";
import { rapprochementDouteux } from "../lib/model.js";

// Bilan de « Compléter les notes manquantes ».
//
// La note vient de RAWG par titre, de Steam par appid, ou de Wikidata : la
// première source qui répond gagne. Cherchée par titre, sur une centaine de
// jeux, un titre approximatif finit par ramener la note d'un autre jeu.
// Plutôt qu'écrire en silence, l'opération rend des comptes — quelle source a
// répondu quoi pour quel jeu — et laisse retirer une note à côté de la plaque.
// Les rapprochements dont les titres ne se recouvrent pas sont signalés
// d'office.
export default function ScoresSheet({ bilan, onAnnulerScore, onClose }) {
  const { trouves, sansScore, stopped, declarees = 0 } = bilan;
  const douteux = trouves.filter(t => rapprochementDouteux(t.titre, t.titreRawg)).length;

  return (
    <Sheet title="Scores complétés" onClose={onClose}>
      <div style={{ color: txt, fontSize: "var(--t-petit)", fontWeight: 600, marginBottom: 4 }}>
        {stopped ? "Interrompu — " : ""}{trouves.length} score{trouves.length > 1 ? "s" : ""} récupéré{trouves.length > 1 ? "s" : ""}
      </div>
      <div style={{ color: mut, fontSize: "var(--t-legende)", marginBottom: 12, lineHeight: 1.5 }}>
        {sansScore.length > 0 && <>{sansScore.length} jeu{sansScore.length > 1 ? "x" : ""} qu'aucune des trois sources ne note — ils ne seront plus reproposés.<br /></>}
        {declarees > 0 && <>{declarees} fiche{declarees > 1 ? "s" : ""} déjà déclarée{declarees > 1 ? "s" : ""} sans note connue : relance l'action quand il n'y aura plus rien d'autre pour les revérifier.<br /></>}
        {douteux > 0
          ? `${douteux} rapprochement${douteux > 1 ? "s" : ""} à vérifier — en orange ci-dessous.`
          : trouves.length > 0 ? "Tous les titres correspondent." : null}
      </div>

      {trouves.map(t => {
        const suspect = rapprochementDouteux(t.titre, t.titreRawg);
        return (
          <div key={t.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 0", borderTop: `1px solid ${bdr}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: txt, fontSize: "var(--t-petit)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.titre}</div>
              <div style={{ color: suspect ? warn : mut, fontSize: "var(--t-legende)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {suspect ? "⚠️ " : ""}RAWG : {t.titreRawg}
              </div>
            </div>
            <span style={{ color: t.score >= 80 ? ok : t.score >= 60 ? warn : danger, fontSize: "var(--t-corps)", fontWeight: 700, flexShrink: 0 }}>{t.score}</span>
            <button onClick={() => onAnnulerScore(t.id)} title="Retirer ce score"
              style={{ flexShrink: 0, minHeight: 34, padding: "0 10px", background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: "var(--r-sm)", fontSize: "var(--t-legende)", cursor: "pointer" }}>
              Retirer
            </button>
          </div>
        );
      })}

      {sansScore.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${bdr}` }}>
          <div style={{ color: mut, fontSize: "var(--t-legende)", fontWeight: 600, marginBottom: 4 }}>Aucune source ne les note</div>
          <div style={{ color: mut, fontSize: "var(--t-legende)", lineHeight: 1.5 }}>{sansScore.join(" · ")}</div>
        </div>
      )}
    </Sheet>
  );
}
