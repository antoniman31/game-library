import { useRef, useState } from "react";
import { MENTION, versionTexte, estDoubleClic } from "../lib/mention.js";

// Logo AM.31, mention et version (règle commune « Interface », 25/11/2026). Le logo est un vrai bouton : un double appui alterne la couleur
// de l'appli (son accent) et le bleu d'origine. Rien n'est mémorisé : à chaque ouverture, la couleur de l'appli.
export default function Signature({ version }) {
  const [origine, setOrigine] = useState(false);
  const dernier = useRef(0);
  const appui = () => {
    const maintenant = performance.now();
    if (estDoubleClic(dernier.current, maintenant)) { setOrigine(o => !o); dernier.current = 0; } else dernier.current = maintenant;
  };
  const commit = version || (typeof __COMMIT__ === "string" ? __COMMIT__ : "");
  return (
    <div className="signature">
      <button type="button" className="am31" data-couleur={origine ? "origine" : "app"} onClick={appui}
        aria-label="Logo AM.31. Double appui : alterner la couleur de l'appli et le bleu d'origine.">
        <span className="am31__logo" aria-hidden="true"><i className="am31__c" /><i className="am31__r" /><i className="am31__l" /></span>
      </button>
      <p className="signature__texte">{MENTION.replace("AntoniMan31/Claude Code", "")}<b>AntoniMan31/Claude Code</b></p>
      <p className="signature__version">{versionTexte(commit, typeof __BUILD_DATE__ === "string" ? __BUILD_DATE__ : "")}</p>
    </div>
  );
}
