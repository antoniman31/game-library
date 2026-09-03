import { txt, mut, bdr } from "../lib/theme.js";

// Infos structurées venues de Wikidata : développeur, éditeur, sorties, mode,
// série.
//
// C'était le bloc le plus lourd de la fiche — encadré, rempli, posé juste sous
// une description coupée à deux lignes. Priorité inversée : la donnée de
// référence qu'on lit une fois criait plus fort que le texte qu'on veut lire.
// Elle est désormais rendue en lignes séparées par des filets, sans cadre :
// elle informe sans peser.
export default function InfoboxView({ info }) {
  if (!info) return null;

  const rel = info.releases?.length
    ? info.releases.map(r => (r.platform ? `${r.date} (${r.platform})` : r.date)).join(" · ")
    : null;
  const serieExtra = [info.follows && `après ${info.follows}`, info.followedBy && `puis ${info.followedBy}`]
    .filter(Boolean).join(", ");
  const serie = info.series ? info.series + (serieExtra ? ` (${serieExtra})` : "") : null;

  const lignes = [
    ["Développeur", info.developers?.join(", ")],
    ["Éditeur", info.publishers?.join(", ")],
    ["Sortie", rel],
    ["Mode", info.modes?.join(", ")],
    ["Série", serie],
  ].filter(([, v]) => v);

  if (!lignes.length) return null;

  return (
    <dl style={{ margin: 0, borderTop: `1px solid ${bdr}` }}>
      {lignes.map(([label, valeur]) => (
        <div key={label} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: `1px solid ${bdr}`, fontSize: 12 }}>
          <dt style={{ color: mut, flex: "0 0 92px" }}>{label}</dt>
          <dd style={{ color: txt, flex: 1, minWidth: 0, margin: 0, lineHeight: 1.4 }}>{valeur}</dd>
        </div>
      ))}
    </dl>
  );
}
