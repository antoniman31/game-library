import { useState, useEffect, useRef } from "react";
import { bdr, bdrChamp, txt, mut, accent, accentFond, dangerDoux, ok, danger } from "../lib/theme.js";
import { XBOX_SERIES_CUTOFF, isBackCompatPlatform } from "../lib/model.js";
import { xblTitleHistory, normTitle, rawgSearch } from "../lib/api.js";
import Sheet from "./Sheet.jsx";

// Import de la bibliothèque Xbox.
//
// Cette fenêtre était la seule à réimplémenter le panneau glissant au lieu
// d'utiliser `Sheet` : même fond noir, même repli par le bas, mais sans piège
// à focus, sans Échap, sans verrou de défilement, sans `role="dialog"` et sans
// croix de fermeture. Elle avait aussi gardé les défauts que les autres
// écrans avaient corrigés depuis — des boutons de trente-neuf pixels (la
// hauteur de leur texte, faute de plancher), un « Tout cocher » de
// vingt-quatre, des lignes de liste sans hauteur minimale, un rayon écrit en
// dur et `85vh` là où `dvh` évite de passer sous la barre d'adresse.
//
// C'est le prix d'une fenêtre écrite à part : elle ne reçoit aucune des
// corrections faites ailleurs, et personne ne s'en aperçoit puisqu'elle
// demande une clé xbl.io pour seulement s'ouvrir.

function ImportModal({ games, onImportGames, onClose }) {
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const cancelRef = useRef(false);

  useEffect(() => {
    (async () => {
      const raw = await xblTitleHistory();
      const existing = new Set(games.map(g => normTitle(g.title)));
      // dédoublonne aussi la liste xbl elle-même (par titre normalisé)
      const seen = new Set();
      const enriched = [];
      for (const t of raw) {
        const key = normTitle(t.name);
        if (seen.has(key)) continue;
        seen.add(key);
        enriched.push({ ...t, isNew: !existing.has(key) });
      }
      enriched.sort((a, b) => (a.isNew === b.isNew ? a.name.localeCompare(b.name) : a.isNew ? -1 : 1));
      const init = {};
      enriched.forEach(t => { if (t.isNew) init[t.name] = true; });
      setList(enriched);
      setChecked(init);
      setLoading(false);
    })();
  }, []); // eslint-disable-line

  const newOnes = list ? list.filter(t => t.isNew) : [];
  const existingCount = list ? list.length - newOnes.length : 0;
  const selectedCount = Object.values(checked).filter(Boolean).length;
  const allChecked = newOnes.length > 0 && newOnes.every(t => checked[t.name]);
  const toggleAll = () => { const v = !allChecked; const c = {}; newOnes.forEach(t => c[t.name] = v); setChecked(c); };

  const doImport = async () => {
    const selected = list.filter(t => t.isNew && checked[t.name]);
    if (!selected.length) return;
    setImporting(true);
    cancelRef.current = false;
    setProgress(0);
    const created = [];
    for (let i = 0; i < selected.length; i++) {
      if (cancelRef.current) break;
      const t = selected[i];
      // Date d'ajout = date de sortie officielle (croisement RAWG), fallback lastPlayed / aujourd'hui.
      let released = null;
      try { const res = await rawgSearch(t.name); released = res[0]?.released || null; } catch {}
      const addedDate = released || (t.lastPlayed ? t.lastPlayed.slice(0, 10) : new Date().toISOString().slice(0, 10));
      const platform = addedDate >= XBOX_SERIES_CUTOFF ? "Xbox Series X" : "Xbox One";
      created.push({
        id: Date.now() + i, title: t.name, platform, format: "démat", addedDate,
        genre: [], style: "", lentA: null, lentDate: null,
        cover: t.image || null, metacritic: null,
        myLinks: ["", "", ""], tips: "", tag: "",
        backCompat: isBackCompatPlatform(platform), infobox: null,
      });
      setProgress(i + 1);
      await new Promise(r => setTimeout(r, 200)); // ménage le rate-limit RAWG
    }
    onImportGames(created);
  };

  return (
    <Sheet title="🎮 Importer ma bibliothèque Xbox" onClose={importing ? () => {} : onClose}>
        {loading && <div style={{ color: accent, fontSize: "var(--t-petit)", padding: "16px 0" }}>Récupération de l'historique Xbox…</div>}

        {!loading && list && (
          <>
            <div style={{ color: mut, fontSize: "var(--t-legende)", marginBottom: 10 }}>
              {newOnes.length} nouveau(x) · {existingCount} déjà présent(s) · {list.length} jeux Xbox détectés
            </div>
            {newOnes.length > 0 && (
              <button onClick={toggleAll} disabled={importing} style={{ alignSelf: "flex-start", background: "transparent", border: `1px solid ${bdrChamp}`, color: mut, borderRadius: "var(--r-xs)", minHeight: "var(--tap-min)", padding: "0 10px", fontSize: "var(--t-legende)", cursor: importing ? "default" : "pointer", opacity: importing ? 0.45 : 1, fontFamily: "inherit", marginBottom: 8 }}>
                {allChecked ? "Tout décocher" : "Tout cocher"}
              </button>
            )}
            <div style={{ overflowY: "auto", maxHeight: "40dvh", border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", marginBottom: 12 }}>
              {list.map((t, i) => (
                <label key={i} style={{ display: "flex", gap: "var(--ecart-tap)", alignItems: "center", minHeight: "var(--tap-min)", padding: "6px 9px", borderBottom: i < list.length - 1 ? `1px solid ${bdr}` : "none", cursor: t.isNew ? "pointer" : "default", opacity: t.isNew ? 1 : 0.5 }}>
                  <input type="checkbox" disabled={!t.isNew || importing} checked={!!checked[t.name]} aria-label={t.name}
                    onChange={e => setChecked(c => ({ ...c, [t.name]: e.target.checked }))}
                    style={{ accentColor: accent, width: 18, height: 18, flexShrink: 0 }} />
                  {t.image && <img src={t.image} alt="" style={{ width: 30, height: 45, minWidth: 30, objectFit: "cover", borderRadius: "var(--r-xs)" }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: txt, fontSize: "var(--t-petit)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                    <div style={{ color: mut, fontSize: "var(--t-legende)" }}>{t.devices.join(", ")}</div>
                  </div>
                  <span style={{ fontSize: "var(--t-legende)", color: t.isNew ? ok : mut, border: `1px solid ${t.isNew ? ok : bdr}`, borderRadius: "var(--r-xs)", padding: "1px 5px", whiteSpace: "nowrap" }}>{t.isNew ? "Nouveau" : "Déjà présent"}</span>
                </label>
              ))}
            </div>
            {importing && <div role="status" style={{ color: accent, fontSize: "var(--t-legende)", marginBottom: 8 }}>Import en cours… {progress}/{selectedCount} (récupération des dates de sortie)</div>}
            {/* `padding: 10` donnait à ces boutons la hauteur de leur texte —
                trente-neuf pixels — pour les deux commandes qui terminent le
                geste. Le plancher se pose, il ne se déduit pas d'une marge. */}
            <div style={{ display: "flex", gap: "var(--ecart-tap)" }}>
              {!importing
                ? <>
                    <button onClick={onClose} style={{ flex: 1, minHeight: "var(--tap)", background: "transparent", border: `1px solid ${bdrChamp}`, color: mut, borderRadius: "var(--r-sm)", padding: "0 12px", cursor: "pointer", fontSize: "var(--t-corps)", fontFamily: "inherit" }}>Annuler</button>
                    <button onClick={doImport} disabled={selectedCount === 0} style={{ flex: 2, minHeight: "var(--tap)", background: accentFond, border: "none", color: "#fff", borderRadius: "var(--r-sm)", padding: "0 12px", cursor: selectedCount ? "pointer" : "default", opacity: selectedCount ? 1 : 0.5, fontSize: "var(--t-corps)", fontWeight: 600, fontFamily: "inherit" }}>Importer {selectedCount} jeu(x)</button>
                  </>
                : <button onClick={() => { cancelRef.current = true; }} style={{ flex: 1, minHeight: "var(--tap)", background: dangerDoux, border: `1px solid ${danger}`, color: danger, borderRadius: "var(--r-sm)", padding: "0 12px", cursor: "pointer", fontSize: "var(--t-corps)", fontWeight: 600, fontFamily: "inherit" }}>Arrêter l'import</button>}
            </div>
          </>
        )}

        {!loading && list && list.length === 0 && (
          <div style={{ color: mut, fontSize: "var(--t-petit)", padding: "8px 0 16px" }}>Aucun jeu Xbox détecté (ou connexion xbl.io indisponible).</div>
        )}
    </Sheet>
  );
}

export default ImportModal;
