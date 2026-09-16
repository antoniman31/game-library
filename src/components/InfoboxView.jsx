import { txt, mut, bdr, accent } from "../lib/theme.js";
import { episodesCites } from "../lib/model.js";

// Infos structurées venues de Wikidata : développeur, éditeur, sorties, mode,
// série.
//
// C'était le bloc le plus lourd de la fiche — encadré, rempli, posé juste sous
// une description coupée à deux lignes. Priorité inversée : la donnée de
// référence qu'on lit une fois criait plus fort que le texte qu'on veut lire.
// Elle est désormais rendue en lignes séparées par des filets, sans cadre :
// elle informe sans peser.
export default function InfoboxView({ info, onSerie, titresPossedes }) {
  if (!info) return null;

  const rel = info.releases?.length
    ? info.releases.map(r => (r.platform ? `${r.date} (${r.platform})` : r.date)).join(" · ")
    : null;

  // Les épisodes tiennent leur propre ligne, et non plus une parenthèse
  // accrochée à la série. Deux raisons : une fiche peut citer un épisode sans
  // appartenir à une série nommée — la parenthèse disparaissait alors avec la
  // ligne « Série », et la donnée stockée n'était jamais affichée —, et il faut
  // de la place pour dire ce que la bibliothèque a ou n'a pas.
  const { precedent, suivant } = episodesCites({ infobox: info }, titresPossedes);
  const nomEpisode = (e, mot) => (
    <span key={mot}>
      {mot} {e.titre}
      {/* Discret, et au conditionnel de fait : un jeu possédé sous un autre
          titre que celui cité serait annoncé absent à tort. */}
      {!e.possede && titresPossedes && (
        <span style={{ color: mut }}> · absent de ta bibliothèque</span>
      )}
    </span>
  );
  const episodes = [precedent && nomEpisode(precedent, "après"), suivant && nomEpisode(suivant, "puis")]
    .filter(Boolean)
    .flatMap((el, i) => (i ? [<span key={`sep${i}`}>, </span>, el] : [el]));

  // La série est le seul champ de ce bloc qui désigne d'autres jeux de la
  // bibliothèque : la rendre touchable évite de retaper « Halo » dans la
  // recherche pour retrouver les cinq autres. C'est aussi la seule façon
  // raisonnable d'offrir un filtre par série — cinquante-huit valeurs ne
  // tiennent pas dans un panneau.
  const valeurSerie = onSerie && info.series
    ? (
      <button onClick={() => onSerie(info.series)}
        title={`Voir les jeux de la série ${info.series}`}
        style={{
          background: "transparent", border: "none", padding: 0, minHeight: "var(--tap-min)",
          color: accent, fontSize: "var(--t-petit)", fontFamily: "inherit",
          cursor: "pointer", textAlign: "left", textDecoration: "underline",
        }}>{info.series}</button>
    )
    : info.series || null;

  const lignes = [
    ["Développeur", info.developers?.join(", ")],
    ["Éditeur", info.publishers?.join(", ")],
    ["Sortie", rel],
    ["Mode", info.modes?.join(", ")],
    ["Série", info.series ? valeurSerie : null],
    ["Épisodes", episodes.length ? <>{episodes}</> : null],
  ].filter(([, v]) => v);

  if (!lignes.length) return null;

  return (
    <dl style={{ margin: 0, borderTop: `1px solid ${bdr}` }}>
      {lignes.map(([label, valeur]) => (
        <div key={label} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: `1px solid ${bdr}`, fontSize: "var(--t-petit)" }}>
          <dt style={{ color: mut, flex: "0 0 92px" }}>{label}</dt>
          <dd style={{ color: txt, flex: 1, minWidth: 0, margin: 0, lineHeight: 1.4 }}>{valeur}</dd>
        </div>
      ))}
    </dl>
  );
}
