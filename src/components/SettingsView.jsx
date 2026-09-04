import { useRef, useState } from "react";
import { card, bdr, txt, mut } from "../lib/theme.js";
import { MODES, LIBELLES, ICONES } from "../lib/apparence.js";
import { pertesDeReglages, messageDePerte, messageCodeSync, CONSEQUENCES } from "../lib/garde-fous.js";
import ChampProtege from "./ChampProtege.jsx";

// Les réglages, refaits.
//
// Le panneau avait poussé par ajouts successifs, et ça se voyait : cinq
// tailles de texte, des boutons de quatre hauteurs différentes dont un à
// 10 px de police, un « Enregistrer » bleu plein voisin de boutons fantômes
// sans hiérarchie, et surtout des flèches qui se contredisaient — « ⬆ Envoyer »
// vers le relais mais « ⬇ Exporter » vers un fichier, alors que les deux
// sortent les données de l'appareil.
//
// Une seule grammaire ici : Section pour les blocs, Champ pour les saisies,
// Bouton en trois intentions (principale, neutre, danger), une hauteur unique
// à la taille du pouce. Et l'ordre suit l'usage réel : ce qu'on règle une
// fois et qu'on regarde souvent en haut, la plomberie en bas.

const ACCENT = "#5493FF";

const Section = ({ titre, aide, children }) => (
  <section style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
    <h2 style={{ color: txt, fontWeight: 600, fontSize: 13, margin: 0 }}>{titre}</h2>
    {aide && <p style={{ color: mut, fontSize: 11, lineHeight: 1.5, margin: "4px 0 0" }}>{aide}</p>}
    <div style={{ marginTop: 12 }}>{children}</div>
  </section>
);

const STYLES_BOUTON = {
  principal: { background: `${ACCENT}22`, border: `1px solid ${ACCENT}`, color: ACCENT, fontWeight: 600 },
  neutre: { background: "transparent", border: `1px solid ${bdr}`, color: txt, fontWeight: 400 },
  danger: { background: "transparent", border: "1px solid #ef4444", color: "#ef4444", fontWeight: 600 },
};

const Bouton = ({ intention = "neutre", pleinePlace, disabled, children, ...reste }) => (
  <button
    disabled={disabled}
    style={{
      ...STYLES_BOUTON[intention],
      minHeight: "var(--tap)", padding: "0 14px", borderRadius: 8, fontSize: 12,
      cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1,
      whiteSpace: "nowrap", flex: pleinePlace ? 1 : "0 0 auto", fontFamily: "inherit",
    }}
    {...reste}
  >{children}</button>
);

const Etiquette = ({ children }) => (
  <div style={{ color: txt, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{children}</div>
);

export default function SettingsView({
  modeTheme, setModeTheme,
  keys, setKeys, appliquerCles, testerCle, etatCles,
  sync, majSync, genererCode, syncEtat, setSyncEtat, onEnvoyer, onRecuperer,
  onExporter, onImporter,
}) {
  const [visible, setVisible] = useState(false);
  const [enregistre, setEnregistre] = useState(false);
  // Le code de synchronisation ne s'écrit qu'à la validation : sinon effacer
  // le champ pour le retaper efface la valeur au premier caractère supprimé.
  const [codeSaisi, setCodeSaisi] = useState(null);
  const importRef = useRef(null);

  const SERVICES = [
    ["rawg", "RAWG", "Jaquettes, notes Metacritic, genres", "https://rawg.io/apidocs"],
    ["sgdb", "SteamGridDB", "Jaquettes au format boîte", "https://www.steamgriddb.com/profile/preferences/api"],
    ["xbl", "xbl.io", "Import de la bibliothèque Xbox", "https://xbl.io/console"],
  ];

  const enregistrerCles = () => {
    const message = messageDePerte(pertesDeReglages(appliquerCles.actuelles, keys));
    if (message && !window.confirm(message)) return;
    appliquerCles.appliquer(keys);
    setEnregistre(true);
    setTimeout(() => setEnregistre(false), 2000);
  };

  const validerCode = () => {
    if (codeSaisi === null) return;
    const message = messageCodeSync(sync.code, codeSaisi);
    if (message && !window.confirm(message)) { setCodeSaisi(null); return; }
    majSync({ ...sync, code: codeSaisi.trim() });
    setCodeSaisi(null);
    setSyncEtat(null);
  };

  const codeAffiche = codeSaisi ?? sync.code;

  return (
    <div>
      {/* Une préférence, réglée une fois : elle ouvre le panneau plutôt que de
          se cacher sous la plomberie. */}
      <Section titre="Apparence" aide="« Automatique » suit le réglage clair/sombre du téléphone, y compris quand il bascule tout seul le soir.">
        <div style={{ display: "flex", gap: 6 }}>
          {MODES.map(m => (
            <Bouton key={m} pleinePlace aria-pressed={modeTheme === m}
              intention={modeTheme === m ? "principal" : "neutre"}
              onClick={() => setModeTheme(m)}>
              {ICONES[m]} {LIBELLES[m]}
            </Bouton>
          ))}
        </div>
      </Section>

      <Section titre="Synchronisation"
        aide="Dépose la bibliothèque sur ton relais Cloudflare pour la retrouver sur un autre appareil. Saisis le même code partout ; il reste sur l'appareil et ne part jamais dans l'export.">
        <Etiquette>Code de synchronisation</Etiquette>
        <div style={{ marginBottom: 10 }}>
          <ChampProtege
            valeur={codeAffiche} visible={visible} placeholder="aucun code"
            ariaLabel="Code de synchronisation"
            quoi="le code de synchronisation"
            consequence="La sauvegarde en ligne existera toujours, mais plus rien ici ne permettra de la retrouver."
            onChange={setCodeSaisi}
            onSupprimer={() => { setCodeSaisi(null); majSync({ ...sync, code: "" }); setSyncEtat(null); }}
            actions={
              <>
                <Bouton onClick={() => {
                  const message = messageCodeSync(sync.code, "nouveau");
                  if (message && !window.confirm(message)) return;
                  setCodeSaisi(null);
                  majSync({ ...sync, code: genererCode() });
                  setSyncEtat(null);
                }}>Générer</Bouton>
                <Bouton disabled={!sync.code} onClick={() => {
                  navigator.clipboard?.writeText(sync.code);
                  setSyncEtat({ type: "ok", texte: "Code copié." });
                }}>Copier</Bouton>
              </>
            }
          />
          {/* La saisie s'applique en quittant le champ : sinon effacer pour
              retaper détruit la valeur au premier caractère supprimé. */}
          {codeSaisi !== null && codeSaisi.trim() !== sync.code && (
            <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
              <Bouton intention="principal" onClick={validerCode}>Appliquer</Bouton>
              <Bouton onClick={() => setCodeSaisi(null)}>Annuler</Bouton>
            </div>
          )}
        </div>

        {/* Les deux flèches se contredisaient : « ⬆ Envoyer » vers le relais et
            « ⬇ Exporter » vers un fichier, pour deux gestes qui sortent tous
            les deux les données d'ici. La direction suit désormais l'appareil :
            ce qui part monte, ce qui arrive descend. */}
        <div style={{ display: "flex", gap: 8 }}>
          <Bouton pleinePlace intention="principal" disabled={syncEtat?.type === "…"} onClick={onEnvoyer}>⬆ Envoyer</Bouton>
          <Bouton pleinePlace disabled={syncEtat?.type === "…"} onClick={onRecuperer}>⬇ Récupérer</Bouton>
        </div>

        {syncEtat && (
          <div role="status" style={{ marginTop: 10, fontSize: 11, lineHeight: 1.4, color: syncEtat.type === "ko" ? "#ef4444" : syncEtat.type === "ok" ? "#22c55e" : mut }}>
            {syncEtat.type === "ok" ? "✓ " : syncEtat.type === "ko" ? "✕ " : "⏳ "}{syncEtat.texte}
          </div>
        )}
        {sync.majLe && syncEtat?.type !== "…" && (
          <div style={{ color: mut, fontSize: 10, marginTop: 6 }}>
            Dernière synchronisation : {new Date(sync.majLe).toLocaleString("fr-FR")}
          </div>
        )}
      </Section>

      <Section titre="Copie hors ligne"
        aide="Un fichier JSON sur cet appareil, utile avant une manipulation risquée ou quand le relais n'est pas configuré. Il contient les jeux, mais ni les clés ni le code de synchronisation.">
        <div style={{ display: "flex", gap: 8 }}>
          <Bouton pleinePlace intention="principal" onClick={onExporter}>⬆ Exporter</Bouton>
          <Bouton pleinePlace onClick={() => importRef.current?.click()}>⬇ Importer</Bouton>
          <input ref={importRef} type="file" accept="application/json,.json" onChange={onImporter} style={{ display: "none" }} />
        </div>
      </Section>

      <Section titre="Clés des services"
        aide="Elles restent sur cet appareil et ne partent qu'aux services concernés. Elles ne figurent ni dans le code, ni dans l'export : effacées ici, elles sont à retrouver sur le site du service.">
        {SERVICES.map(([id, nom, quoi, lien]) => (
          <div key={id} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ color: txt, fontSize: 12, fontWeight: 600 }}>{nom}</span>
              <a href={lien} target="_blank" rel="noreferrer" style={{ color: ACCENT, fontSize: 11, textDecoration: "none" }}>obtenir ↗</a>
              <span style={{ color: mut, fontSize: 11 }}>{quoi}</span>
            </div>
            <ChampProtege
              valeur={keys[id]} visible={visible} placeholder="non configurée"
              ariaLabel={`Clé ${nom}`}
              quoi={CONSEQUENCES[id][0]} consequence={`Conséquence : ${CONSEQUENCES[id][1]}.`}
              onChange={v => setKeys(k => ({ ...k, [id]: v.trim() }))}
              onSupprimer={() => { const videes = { ...keys, [id]: "" }; setKeys(videes); appliquerCles.appliquer(videes); }}
              actions={
                <>
                  <Bouton disabled={!keys[id]} onClick={() => testerCle(id)}>Tester</Bouton>
                  <span aria-live="polite" style={{ fontSize: 14, width: 18, textAlign: "center", flexShrink: 0 }}>
                    {etatCles[id] === "ok" ? "✅" : etatCles[id] === "ko" ? "❌" : etatCles[id] === "…" ? "⏳" : ""}
                  </span>
                </>
              }
            />
          </div>
        ))}

        <div style={{ marginBottom: 12 }}>
          <Etiquette>Relais CORS (Worker Cloudflare)</Etiquette>
          <div style={{ color: mut, fontSize: 11, marginBottom: 4, lineHeight: 1.4 }}>
            Requis en ligne pour SteamGridDB, l'import Xbox et la synchronisation. À laisser vide en développement local.
          </div>
          <ChampProtege
            valeur={keys.proxy} visible placeholder="https://mon-worker.workers.dev"
            ariaLabel="Adresse du relais"
            quoi={CONSEQUENCES.proxy[0]} consequence={`Conséquence : ${CONSEQUENCES.proxy[1]}.`}
            onChange={v => setKeys(k => ({ ...k, proxy: v.trim() }))}
            onSupprimer={() => { const videes = { ...keys, proxy: "" }; setKeys(videes); appliquerCles.appliquer(videes); }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Bouton intention="principal" onClick={enregistrerCles}>Enregistrer</Bouton>
          <Bouton onClick={() => setVisible(v => !v)}>{visible ? "Masquer" : "Afficher"}</Bouton>
          {enregistre && <span role="status" style={{ color: "#22c55e", fontSize: 11 }}>Enregistré ✓</span>}
        </div>
      </Section>
    </div>
  );
}
