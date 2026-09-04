import { useState, useEffect, useRef } from "react";
import { card, bdr, txt, mut, accent, accentFond, dangerDoux, ok, danger } from "../lib/theme.js";
import { XBOX_SERIES_CUTOFF, isBackCompatPlatform } from "../lib/model.js";
import { xblTitleHistory, normTitle, rawgSearch } from "../lib/api.js";

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
    <div style={{ position: "fixed", inset: 0, background: "#000b", zIndex: 300, display: "flex", alignItems: "flex-end" }} onClick={importing ? undefined : onClose}>
      <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: "16px 16px 0 0", padding: "20px 20px calc(20px + var(--safe-bottom))", width: "100%", maxWidth: 500, margin: "0 auto", maxHeight: "85vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 15, color: txt, marginBottom: 4 }}>🎮 Importer ma bibliothèque Xbox</div>
        {loading && <div style={{ color: accent, fontSize: 12, padding: "16px 0" }}>Récupération de l'historique Xbox…</div>}

        {!loading && list && (
          <>
            <div style={{ color: mut, fontSize: 11, marginBottom: 10 }}>
              {newOnes.length} nouveau(x) · {existingCount} déjà présent(s) · {list.length} jeux Xbox détectés
            </div>
            {newOnes.length > 0 && (
              <button onClick={toggleAll} disabled={importing} style={{ alignSelf: "flex-start", background: "transparent", border: `1px solid ${bdr}`, color: mut, borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer", marginBottom: 8 }}>
                {allChecked ? "Tout décocher" : "Tout cocher"}
              </button>
            )}
            <div style={{ overflowY: "auto", flex: 1, border: `1px solid ${bdr}`, borderRadius: 8, marginBottom: 12 }}>
              {list.map((t, i) => (
                <label key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 9px", borderBottom: i < list.length - 1 ? `1px solid ${bdr}` : "none", cursor: t.isNew ? "pointer" : "default", opacity: t.isNew ? 1 : 0.5 }}>
                  <input type="checkbox" disabled={!t.isNew || importing} checked={!!checked[t.name]} onChange={e => setChecked(c => ({ ...c, [t.name]: e.target.checked }))} style={{ accentColor: accent }} />
                  {t.image && <img src={t.image} alt="" style={{ width: 30, height: 45, minWidth: 30, objectFit: "cover", borderRadius: 3 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: txt, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                    <div style={{ color: mut, fontSize: 9 }}>{t.devices.join(", ")}</div>
                  </div>
                  <span style={{ fontSize: 9, color: t.isNew ? ok : mut, border: `1px solid ${t.isNew ? ok : bdr}`, borderRadius: 3, padding: "1px 5px", whiteSpace: "nowrap" }}>{t.isNew ? "Nouveau" : "Déjà présent"}</span>
                </label>
              ))}
            </div>
            {importing && <div style={{ color: accent, fontSize: 11, marginBottom: 8 }}>Import en cours… {progress}/{selectedCount} (récupération des dates de sortie)</div>}
            <div style={{ display: "flex", gap: 8 }}>
              {!importing
                ? <>
                    <button onClick={onClose} style={{ flex: 1, background: "transparent", border: `1px solid ${bdr}`, color: "#94a3b8", borderRadius: 8, padding: 10, cursor: "pointer", fontSize: 13 }}>Annuler</button>
                    <button onClick={doImport} disabled={selectedCount === 0} style={{ flex: 2, background: accentFond, border: "none", color: "#fff", borderRadius: 8, padding: 10, cursor: selectedCount ? "pointer" : "default", opacity: selectedCount ? 1 : 0.5, fontSize: 13, fontWeight: 600 }}>Importer {selectedCount} jeu(x)</button>
                  </>
                : <button onClick={() => { cancelRef.current = true; }} style={{ flex: 1, background: dangerDoux, border: `1px solid ${danger}`, color: danger, borderRadius: 8, padding: 10, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Arrêter l'import</button>}
            </div>
          </>
        )}

        {!loading && list && list.length === 0 && (
          <div style={{ color: mut, fontSize: 12, padding: "8px 0 16px" }}>Aucun jeu Xbox détecté (ou connexion xbl.io indisponible).</div>
        )}
      </div>
    </div>
  );
}

export default ImportModal;
