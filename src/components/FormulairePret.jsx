import { useState } from "react";
import { bdr, bdrChamp, txt, mut, warn, warnDoux } from "../lib/theme.js";
import { preterJeu } from "../lib/model.js";

// À qui, et jusqu'à quand.
//
// Extrait de la fiche le jour où le balayage a eu besoin du même formulaire.
// Deux copies du même geste, c'est deux endroits où corriger une validation et
// un seul qu'on pense à corriger — le projet a déjà payé ça sur la date d'ajout
// et sur la plateforme.
//
// La date est facultative, et c'est délibéré : sans elle, le seuil de trente
// jours sert de repli. Exiger une date à chaque prêt découragerait d'en
// enregistrer.
export default function FormulairePret({ jeu, onPreter, autoFocus = false }) {
  const [nom, setNom] = useState("");
  const [retour, setRetour] = useState("");
  const pret = nom.trim();

  const valider = () => {
    const j = preterJeu(jeu, nom, retour);
    // `preterJeu` rend le jeu inchangé quand le nom est vide : s'en remettre à
    // son verdict plutôt que de revalider ici évite deux règles divergentes.
    if (j === jeu) return;
    onPreter(j);
    setNom("");
    setRetour("");
  };

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: "block", color: mut, fontSize: "var(--t-legende)", marginBottom: 4 }}>Prêté à</span>
      <div style={{ display: "flex", gap: "var(--ecart-tap)" }}>
        <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom…" autoFocus={autoFocus}
          aria-label="Nom de la personne à qui prêter ce jeu"
          onKeyDown={e => { if (e.key === "Enter" && pret) valider(); }}
          style={{ flex: 1, minWidth: 0, minHeight: "var(--tap-min)", background: "transparent", border: `1px solid ${bdrChamp}`, borderRadius: "var(--r-sm)", color: txt, padding: "0 10px", fontFamily: "inherit" }} />
        <button onClick={valider} disabled={!pret}
          style={{ minHeight: "var(--tap-min)", padding: "0 14px", background: pret ? warnDoux : "transparent", border: `1px solid ${pret ? warn : bdr}`, color: pret ? warn : mut, borderRadius: "var(--r-sm)", fontSize: "var(--t-petit)", fontWeight: 600, cursor: pret ? "pointer" : "default" }}>Prêter</button>
      </div>
      <label style={{ display: "flex", gap: "var(--ecart-tap)", alignItems: "center", marginTop: "var(--ecart-tap)" }}>
        <span style={{ color: mut, fontSize: "var(--t-legende)", flexShrink: 0 }}>À rendre le</span>
        <input type="date" value={retour} onChange={e => setRetour(e.target.value)}
          style={{ flex: 1, minWidth: 0, minHeight: "var(--tap-min)", background: "transparent", border: `1px solid ${bdrChamp}`, borderRadius: "var(--r-sm)", color: txt, padding: "0 8px", fontFamily: "inherit" }} />
      </label>
    </div>
  );
}
