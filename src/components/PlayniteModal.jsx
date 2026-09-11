import { useState } from "react";
import { bdr, txt, mut, accent, accentFond, ok, bdrChamp } from "../lib/theme.js";
import Sheet from "./Sheet.jsx";
import { lirePlaynite, analyserImport, jeuxAImporter } from "../lib/playnite.js";

// Import d'un export Playnite.
//
// Rien n'entre dans la bibliothèque avant que l'écran ait montré ce qu'il a
// compris : cent lignes qui arrivent d'un coup sans récapitulatif, c'est un
// import qu'on n'ose pas relancer. Chaque ligne porte donc son sort — nouvelle,
// déjà présente, exclue, ignorée — et seules les nouvelles sont cochables.
//
// Le panneau est un `Sheet` comme les autres : Échap referme, le focus reste
// dedans, la liste ne défile pas derrière. Une fenêtre écrite à part aurait
// perdu ces trois-là sans que personne ne s'en aperçoive avant longtemps.

const ETIQUETTES = {
  nouveau: ["Nouveau", ok],
  deja: ["Déjà présent", null],
  exclu: ["Écarté", null],
  ignore: ["Ignoré", null],
};

function PlayniteModal({ games, exclusions, onImport, onClose }) {
  const [analyse, setAnalyse] = useState(null);
  const [erreur, setErreur] = useState("");
  const [coches, setCoches] = useState({});
  const [nomFichier, setNomFichier] = useState("");

  const lireFichier = async (fichier) => {
    if (!fichier) return;
    setNomFichier(fichier.name);
    let contenu = "";
    try {
      contenu = await fichier.text();
    } catch {
      setErreur("Fichier illisible sur cet appareil.");
      setAnalyse(null);
      return;
    }
    const { entrees, ignorees, erreur: err } = lirePlaynite(contenu);
    if (err) { setErreur(err); setAnalyse(null); return; }
    const { nouveaux, deja, exclus } = analyserImport(entrees, { games, exclusions });
    setErreur("");
    setAnalyse({ nouveaux, deja, exclus, ignorees });
    const init = {};
    for (const n of nouveaux) init[n.ref] = true;
    setCoches(init);
  };

  const nouveaux = analyse?.nouveaux || [];
  const avecJumelle = nouveaux.filter(n => n.jumelle).length;
  const choisis = nouveaux.filter(n => coches[n.ref]);
  const toutCoche = nouveaux.length > 0 && choisis.length === nouveaux.length;
  const basculerTout = () => {
    const v = !toutCoche;
    const c = {};
    for (const n of nouveaux) c[n.ref] = v;
    setCoches(c);
  };

  // Une seule liste, dans l'ordre où les sorts intéressent : ce qui va entrer
  // d'abord, ce qui explique les absences ensuite.
  const lignes = analyse
    ? [
        ...nouveaux.map(e => ({ ...e, sort: "nouveau" })),
        ...analyse.deja.map(e => ({ ...e, sort: "deja" })),
        ...analyse.exclus.map(e => ({ ...e, sort: "exclu" })),
        ...analyse.ignorees.map(e => ({ ...e, sort: "ignore" })),
      ]
    : [];

  return (
    <Sheet title="Importer depuis Playnite" onClose={onClose}>
      {!analyse && (
        <p style={{ color: mut, fontSize: "var(--t-petit)", lineHeight: 1.45, margin: "0 0 14px" }}>
          Choisis le fichier JSON produit par le script d'export de Playnite. Chaque ligne devient une
          fiche PC avec sa boutique. Rien n'est écrit avant que tu aies vu la liste.
        </p>
      )}

      <label style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "var(--tap)", border: `1px solid ${bdrChamp}`, borderRadius: "var(--r-sm)", color: txt, fontSize: "var(--t-corps)", cursor: "pointer", marginBottom: 12, padding: "0 10px", textAlign: "center" }}>
        {nomFichier || "Choisir un fichier…"}
        <input type="file" accept=".json,application/json" aria-label="Fichier d'export Playnite"
          onChange={e => lireFichier(e.target.files?.[0])}
          style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
      </label>

      {erreur && <p style={{ color: txt, fontSize: "var(--t-petit)", margin: "0 0 12px" }}>{erreur}</p>}

      {analyse && (
        <>
          <div style={{ color: mut, fontSize: "var(--t-legende)", marginBottom: 10 }}>
            {nouveaux.length} nouveau(x) · {analyse.deja.length} déjà présent(s) · {analyse.exclus.length} écarté(s) · {analyse.ignorees.length} ignoré(s)
            {avecJumelle > 0 && <><br />{avecJumelle} rempli(s) depuis une fiche déjà là</>}
          </div>
          {nouveaux.length > 0 && (
            <button onClick={basculerTout} style={{ background: "transparent", border: `1px solid ${bdrChamp}`, color: mut, borderRadius: "var(--r-xs)", minHeight: "var(--tap-min)", padding: "0 10px", fontSize: "var(--t-legende)", cursor: "pointer", marginBottom: 8 }}>
              {toutCoche ? "Tout décocher" : "Tout cocher"}
            </button>
          )}
          <div style={{ border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)", marginBottom: 12 }}>
            {lignes.map((l, i) => {
              const [libelle, couleur] = ETIQUETTES[l.sort];
              const cochable = l.sort === "nouveau";
              return (
                <label key={`${l.sort}-${l.ref || l.titre}-${i}`} style={{ display: "flex", gap: 8, alignItems: "center", minHeight: "var(--tap-min)", padding: "6px 9px", borderBottom: i < lignes.length - 1 ? `1px solid ${bdr}` : "none", cursor: cochable ? "pointer" : "default" }}>
                  <input type="checkbox" disabled={!cochable} checked={!!coches[l.ref]} aria-label={l.titre}
                    onChange={e => setCoches(c => ({ ...c, [l.ref]: e.target.checked }))}
                    style={{ accentColor: accent, width: 18, height: 18, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: txt, fontSize: "var(--t-petit)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.titre}</div>
                    {/* Le titre ne se coupe pas ; la raison, elle, s'explique et
                        peut passer à la ligne — la tronquer laisserait « plateforme de
                        console ou ému… », qui n'apprend rien. */}
                    <div style={{ color: mut, fontSize: "var(--t-legende)", lineHeight: 1.35 }}>
                      {l.raison
                        ? `${l.raison}${l.detail ? ` · ${l.detail}` : ""}`
                        : `${l.boutique || "sans boutique"}${l.jumelle ? ` · déjà sur ${l.jumelle}` : ""}`}
                    </div>
                  </div>
                  <span style={{ fontSize: "var(--t-legende)", color: couleur || mut, border: `1px solid ${couleur || bdr}`, borderRadius: "var(--r-xs)", padding: "1px 5px", whiteSpace: "nowrap" }}>{libelle}</span>
                </label>
              );
            })}
          </div>
          <button onClick={() => onImport(jeuxAImporter(choisis, Date.now(), games))} disabled={!choisis.length}
            style={{ width: "100%", background: accentFond, border: "none", color: "#fff", borderRadius: "var(--r-sm)", minHeight: "var(--tap)", cursor: choisis.length ? "pointer" : "default", opacity: choisis.length ? 1 : 0.5, fontSize: "var(--t-corps)", fontWeight: 600 }}>
            Importer {choisis.length} jeu(x)
          </button>
        </>
      )}
    </Sheet>
  );
}

export default PlayniteModal;
