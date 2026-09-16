import { useState } from "react";
import { sourceJaquette } from "../lib/jaquettes.js";

// Jaquette au format boîte de jeu : rectangle vertical ~2:3.
//
// `sourceJaquette` est le seul endroit qui sait qu'une image peut être sur
// l'appareil : elle rend le fichier descendu s'il existe, l'URL d'origine
// sinon. La fiche, elle, ne porte que l'URL — c'est ce qui permet à l'export
// et à la synchronisation de rester lisibles ailleurs que sur ce téléphone.
//
// Et si le fichier local a disparu — stockage nettoyé par le système —, le
// `onError` qui existait déjà pour les URL mortes reprend la main : on
// réessaie l'adresse d'origine avant d'abandonner sur la vignette 🎮.
function Cover({ src, title, size = 72 }) {
  const [err, setErr] = useState(false);
  const [localRate, setLocalRate] = useState(false);
  // `"".charCodeAt(0)` vaut NaN, et l'index NaN donnait une couleur `undefined`.
  const bg = ["#1a2a4a","#2a1a4a","#1a4a2a","#4a2a1a","#2a4a4a"][(title?.charCodeAt(0) || 0) % 5];
  const isFull = size === "100%";
  const box = isFull
    ? { width: "100%", aspectRatio: "2 / 3", minWidth: 0 }
    : { width: size, height: size * 1.5, minWidth: size };
  if (!src || err) return (
    <div style={{ ...box, background: bg, borderRadius: "var(--r-sm)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isFull ? 40 : size * 0.4 }}>🎮</div>
  );
  const affichee = localRate ? src : sourceJaquette(src);
  // `lazy` et `async` : la liste monte deux cent quatre-vingt-huit fiches d'un
  // coup, dont l'immense majorité hors écran. Sans ces deux attributs, le
  // navigateur télécharge et surtout *décode* toutes leurs images au montage —
  // et décoder coûte autant quand le fichier est sur l'appareil que quand il
  // vient du réseau, puisque ce qui coûte est de transformer du PNG en pixels.
  return <img src={affichee} alt={title} loading="lazy" decoding="async"
    onError={() => (affichee !== src ? setLocalRate(true) : setErr(true))}
    style={{ ...box, objectFit: "cover", borderRadius: "var(--r-sm)", display: "block" }} />;
}


export default Cover;
