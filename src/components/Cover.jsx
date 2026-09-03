import { useState } from "react";

// Jaquette au format boîte de jeu : rectangle vertical ~2:3.
function Cover({ src, title, size = 72 }) {
  const [err, setErr] = useState(false);
  // `"".charCodeAt(0)` vaut NaN, et l'index NaN donnait une couleur `undefined`.
  const bg = ["#1a2a4a","#2a1a4a","#1a4a2a","#4a2a1a","#2a4a4a"][(title?.charCodeAt(0) || 0) % 5];
  const isFull = size === "100%";
  const box = isFull
    ? { width: "100%", aspectRatio: "2 / 3", minWidth: 0 }
    : { width: size, height: size * 1.5, minWidth: size };
  if (!src || err) return (
    <div style={{ ...box, background: bg, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isFull ? 40 : size * 0.4 }}>🎮</div>
  );
  return <img src={src} alt={title} onError={() => setErr(true)} style={{ ...box, objectFit: "cover", borderRadius: 8, display: "block" }} />;
}


export default Cover;
