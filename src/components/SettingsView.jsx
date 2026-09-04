import { useRef, useState } from "react";
import { card, bdr, txt, mut, accent, accentDoux, accentFond, ok, danger } from "../lib/theme.js";
import { MODES, LIBELLES, ICONES } from "../lib/apparence.js";
import { pertesDeReglages, messageDePerte, messageCodeSync, CONSEQUENCES } from "../lib/garde-fous.js";
import ChampProtege from "./ChampProtege.jsx";
import SousOnglets from "./SousOnglets.jsx";

// Les réglages, refaits.
//
// Le panneau avait poussé par ajouts successifs, et ça se voyait : cinq
// tailles de texte, des boutons de quatre hauteurs différentes dont un à
// 10 px de police, un « Enregistrer » bleu plein voisin de boutons fantômes
// sans hiérarchie, et surtout des flèches qui se contredisaient — « ⬆ Envoyer »
// vers le relais mais « ⬇ Exporter » vers un fichier, alors que les deux
// sortent les données de l'appareil.
//
// Une seule grammaire ici : Section pour les blocs, EnTeteChamp pour nommer
// une saisie, Bouton en trois intentions (principale, neutre, danger), une
// hauteur unique à la taille du pouce.
//
// Deux sous-onglets, comme dans les Stats et avec le même sélecteur : depuis
// que les clés se verrouillent, « Clés des services » a doublé de hauteur et
// repoussait la synchronisation hors de l'écran. Sauvegarde répond à « où
// vont mes données », Services à « avec quoi l'application parle dehors ».
//
// L'apparence reste au-dessus des onglets plutôt que dans l'un des deux :
// trois boutons ne remplissent pas un onglet, et c'est le seul réglage qu'on
// change par envie plutôt que par nécessité — l'enterrer d'un clic serait le
// punir de sa légèreté.

const ACCENT = accent;

const Section = ({ titre, aide, children }) => (
  <section style={{ background: card, border: `1px solid ${bdr}`, borderRadius: "var(--r-md)", padding: 14, marginBottom: 12 }}>
    <h2 style={{ color: txt, fontWeight: 600, fontSize: 13, margin: 0 }}>{titre}</h2>
    {aide && <p style={{ color: mut, fontSize: 11, lineHeight: 1.5, margin: "4px 0 0" }}>{aide}</p>}
    <div style={{ marginTop: 12 }}>{children}</div>
  </section>
);

// L'application avait trois grammaires pour dire « c'est ce bouton-là » :
// l'aplat bleu dans l'en-tête et les fenêtres d'ajout, le contour teinté ici,
// et un troisième dans les filtres. Von Restorff ne fonctionne que si la forme
// remarquable est la même partout : l'aplat est l'action principale, partout.
//
// Le contour teinté n'a pas disparu, il a changé de métier : il ne dit plus
// « fais ceci », il dit « c'est ce qui est choisi » — le mode de thème actif,
// exactement comme un sous-onglet sélectionné.
const STYLES_BOUTON = {
  principal: { background: accentFond, border: "1px solid transparent", color: "#fff", fontWeight: 600 },
  selection: { background: accentDoux, border: `1px solid ${ACCENT}`, color: ACCENT, fontWeight: 600 },
  neutre: { background: "transparent", border: `1px solid ${bdr}`, color: txt, fontWeight: 400 },
  danger: { background: "transparent", border: `1px solid ${danger}`, color: danger, fontWeight: 600 },
};

const Bouton = ({ intention = "neutre", pleinePlace, disabled, children, ...reste }) => (
  <button
    disabled={disabled}
    style={{
      ...STYLES_BOUTON[intention],
      minHeight: "var(--tap)", padding: "0 14px", borderRadius: "var(--r-sm)", fontSize: 12,
      cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1,
      whiteSpace: "nowrap", flex: pleinePlace ? 1 : "0 0 auto", fontFamily: "inherit",
    }}
    {...reste}
  >{children}</button>
);

// Le nom d'un champ, éventuellement suivi du lien pour obtenir la valeur et
// de ce qu'elle sert. Les clés portaient cet en-tête, le code de
// synchronisation et le relais en avaient chacun un différent.
// « obtenir ↗ » était un lien de 13 px de haut posé au fil du texte : la cible
// la plus petite de l'application, pour l'action qui sort de l'application.
// Il passe à droite, à la hauteur des autres commandes, et l'explication prend
// la ligne du dessous plutôt que de se disputer la première.
const EnTeteChamp = ({ nom, lien, quoi }) => (
  <div style={{ marginBottom: 4 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--ecart-tap)", minHeight: "var(--tap-min)" }}>
      <span style={{ color: txt, fontSize: 12, fontWeight: 600, minWidth: 0 }}>{nom}</span>
      {lien && (
        <a href={lien} target="_blank" rel="noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", flexShrink: 0,
            minHeight: "var(--tap-min)", padding: "0 10px",
            border: `1px solid ${bdr}`, borderRadius: "var(--r-sm)",
            color: ACCENT, fontSize: 11, textDecoration: "none",
          }}>obtenir ↗</a>
      )}
    </div>
    {quoi && <span style={{ display: "block", color: mut, fontSize: 11, lineHeight: 1.4 }}>{quoi}</span>}
  </div>
);

export default function SettingsView({
  modeTheme, setModeTheme,
  keys, setKeys, appliquerCles, testerCle, etatCles,
  sync, majSync, genererCode, syncEtat, setSyncEtat, onEnvoyer, onRecuperer,
  onExporter, onImporter,
}) {
  const [onglet, setOnglet] = useState("sauvegarde");
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
      {/* Trois boutons ne remplissent pas un onglet, et c'est le seul réglage
          qu'on change par envie : il reste au-dessus, visible d'emblée. */}
      <Section titre="Apparence" aide="« Automatique » suit le réglage clair/sombre du téléphone, y compris quand il bascule tout seul le soir. Le sombre est un vrai noir : sur une dalle OLED, un pixel noir est un pixel éteint.">
        <div style={{ display: "flex", gap: "var(--ecart-tap)" }}>
          {MODES.map(m => (
            <Bouton key={m} pleinePlace aria-pressed={modeTheme === m}
              intention={modeTheme === m ? "selection" : "neutre"}
              onClick={() => setModeTheme(m)}>
              {ICONES[m]} {LIBELLES[m]}
            </Bouton>
          ))}
        </div>
      </Section>

      <SousOnglets valeur={onglet} onChange={setOnglet}
        options={[["sauvegarde", "Sauvegarde"], ["services", "Services"]]} />

      {onglet === "sauvegarde" ? (
        <>
          <Section titre="Synchronisation"
            aide="Dépose la bibliothèque sur ton relais Cloudflare pour la retrouver sur un autre appareil. Saisis le même code partout ; il reste sur l'appareil et ne part jamais dans l'export.">
            <div style={{ marginBottom: 10 }}>
              <EnTeteChamp nom="Code de synchronisation" />
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
              {/* La saisie s'applique à la validation : sinon effacer pour
                  retaper détruit la valeur au premier caractère supprimé. */}
              {codeSaisi !== null && codeSaisi.trim() !== sync.code && (
                <div style={{ display: "flex", gap: "var(--ecart-tap)", marginTop: 6, alignItems: "center" }}>
                  <Bouton intention="principal" onClick={validerCode}>Appliquer</Bouton>
                  <Bouton onClick={() => setCodeSaisi(null)}>Annuler</Bouton>
                </div>
              )}
            </div>

            {/* Les deux flèches se contredisaient : « ⬆ Envoyer » vers le relais
                et « ⬇ Exporter » vers un fichier, pour deux gestes qui sortent
                tous les deux les données d'ici. La direction suit désormais
                l'appareil : ce qui part monte, ce qui arrive descend. */}
            <div style={{ display: "flex", gap: 8 }}>
              <Bouton pleinePlace intention="principal" disabled={syncEtat?.type === "…"} onClick={onEnvoyer}>⬆ Envoyer</Bouton>
              <Bouton pleinePlace disabled={syncEtat?.type === "…"} onClick={onRecuperer}>⬇ Récupérer</Bouton>
            </div>

            {syncEtat && (
              <div role="status" style={{ marginTop: 10, fontSize: 11, lineHeight: 1.4, color: syncEtat.type === "ko" ? danger : syncEtat.type === "ok" ? ok : mut }}>
                {syncEtat.type === "ok" ? "✓ " : syncEtat.type === "ko" ? "✕ " : "⏳ "}{syncEtat.texte}
              </div>
            )}
            {/* Les clés ne partent que si on le demande, et la conséquence est
            écrite à côté : cocher change ce que le code de synchronisation
            protège — une liste de jeux devient une liste d'identifiants. */}
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${bdr}`, cursor: "pointer" }}>
          <input type="checkbox" checked={!!sync.avecCles}
            onChange={e => majSync({ ...sync, avecCles: e.target.checked })}
            style={{ marginTop: 2, width: 16, height: 16, accentColor: ACCENT, flexShrink: 0 }} />
          <span>
            <span style={{ color: txt, fontSize: 12, fontWeight: 600 }}>Inclure les clés des services</span>
            <span style={{ display: "block", color: mut, fontSize: 11, lineHeight: 1.5, marginTop: 2 }}>
              Un appareil neuf devient utilisable dès la saisie du code, sans aller rechercher les clés
              sur trois sites. En échange, elles sont stockées en clair sur ton relais et le code de
              synchronisation devient le seul verrou qui les protège — ne le partage plus en croyant
              ne partager qu'une liste de jeux. L'adresse du relais, elle, ne part jamais : elle est
              nécessaire pour joindre la sauvegarde.
            </span>
          </span>
        </label>

        {sync.majLe && syncEtat?.type !== "…" && (
              <div style={{ color: mut, fontSize: 11, marginTop: 6 }}>
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
        </>
      ) : (
        <Section titre="Clés et relais"
          aide="Tout reste sur cet appareil et ne part qu'aux services concernés. Rien ne figure dans le code ni dans l'export : effacée ici, une valeur est à retrouver sur le site du service.">
          {SERVICES.map(([id, nom, quoi, lien]) => (
            <div key={id} style={{ marginBottom: 12 }}>
              <EnTeteChamp nom={nom} lien={lien} quoi={quoi} />
              <ChampProtege
                valeur={keys[id]} visible={visible} placeholder="non configurée"
                ariaLabel={`Clé ${nom}`}
                quoi={CONSEQUENCES[id][0]} consequence={`Conséquence : ${CONSEQUENCES[id][1]}.`}
                onChange={v => setKeys(k => ({ ...k, [id]: v.trim() }))}
                onSupprimer={() => { const videes = { ...keys, [id]: "" }; setKeys(videes); appliquerCles.appliquer(videes); }}
                actions={
                  <>
                    <Bouton disabled={!keys[id]} onClick={() => testerCle(id)}>Tester</Bouton>
                    <span aria-live="polite" style={{ fontSize: 15, width: 18, textAlign: "center", flexShrink: 0 }}>
                      {etatCles[id] === "ok" ? "✅" : etatCles[id] === "ko" ? "❌" : etatCles[id] === "…" ? "⏳" : ""}
                    </span>
                  </>
                }
              />
            </div>
          ))}

          <div style={{ marginBottom: 12 }}>
            <EnTeteChamp nom="Relais CORS"
              quoi="Worker Cloudflare, requis en ligne pour SteamGridDB, l'import Xbox et la synchronisation. À laisser vide en développement local." />
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
            {enregistre && <span role="status" style={{ color: ok, fontSize: 11 }}>Enregistré ✓</span>}
          </div>
        </Section>
      )}
    </div>
  );
}
