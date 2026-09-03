import { txt, mut } from "../lib/theme.js";

function InfoboxView({ info }) {
  if (!info) return null;
  const row = (label, val) => val ? <div style={{ fontSize: 11, color: mut, marginBottom: 3, lineHeight: 1.35 }}><span style={{ color: txt, fontWeight: 600 }}>{label} : </span>{val}</div> : null;
  const rel = info.releases?.length ? info.releases.map(r => r.platform ? `${r.date} (${r.platform})` : r.date).join(" · ") : null;
  const serieExtra = [info.follows && `après ${info.follows}`, info.followedBy && `puis ${info.followedBy}`].filter(Boolean).join(", ");
  const serie = info.series ? info.series + (serieExtra ? ` (${serieExtra})` : "") : null;
  return (
    <div>
      {row("Développeur", info.developers?.join(", "))}
      {row("Éditeur", info.publishers?.join(", "))}
      {row("Sortie", rel)}
      {row("Mode", info.modes?.join(", "))}
      {row("Série", serie)}
    </div>
  );
}

export default InfoboxView;
