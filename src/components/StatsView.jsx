import { useMemo, useState } from "react";
import { card, bdr, txt, mut, accent, accentFond, ok, okFond, warn, warnFond, danger, dangerFond } from "../lib/theme.js";
import { PLATFORM_COLORS } from "../lib/model.js";
import { statsCirculation, statsCollection } from "../lib/stats.js";
import SousOnglets from "./SousOnglets.jsx";

// L'onglet Stats montrait trois chiffres et les genres, alors que
// l'application stocke bien davantage. Deux sous-onglets, parce que les deux
// familles ne répondent pas à la même question : ce qui circule (qui a quoi,
// combien de temps) et ce qu'on possède (quoi, sur quoi, dans quel état).
//
// Chaque bloc disparaît quand il n'a rien à dire. Un « aucune donnée » répété
// six fois occupe autant de place qu'un vrai contenu et n'en apporte aucun.

const Bloc = ({ titre, children }) => (
  <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: "var(--r-md)", padding: 14, marginBottom: "var(--ecart-bloc)" }}>
    <div style={{ color: txt, fontWeight: 600, fontSize: "var(--t-corps)", marginBottom: 10 }}>{titre}</div>
    {children}
  </div>
);

// Une ligne de comptage avec sa barre. Le dénominateur est passé
// explicitement : rapporter des genres à un total de jeux et des prêts à un
// total de prêts ne se compare pas.
const Barre = ({ label, valeur, total, couleur = accentFond, suffixe }) => (
  <div style={{ marginBottom: 8 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 3 }}>
      <span style={{ color: txt, fontSize: "var(--t-petit)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ color: mut, fontSize: "var(--t-legende)", flexShrink: 0 }}>{suffixe ?? valeur}</span>
    </div>
    <div style={{ height: 4, background: bdr, borderRadius: "var(--r-xs)" }}>
      <div style={{ width: `${total ? (valeur / total) * 100 : 0}%`, height: "100%", background: couleur, borderRadius: "var(--r-xs)" }} />
    </div>
  </div>
);

// Pour une catégorie sans couleur propre — une boutique, contrairement à une
// plateforme, n'en a pas dans le modèle — un cycle sur les quatre aplats du
// thème. Pas de teinte en plus écrite en dur : le thème clair ne pourrait
// pas la corriger.
const PALETTE = [accentFond, warnFond, okFond, dangerFond];
const couleurCycle = (i) => PALETTE[i % PALETTE.length];

// Un anneau plutôt qu'une pile de barres, pour une répartition fermée : le
// tout se lit d'un coup d'œil, sans additionner des largeurs de bande à la
// main. Un dégradé conique CSS suffit — pas de bibliothèque, pas de tracé SVG
// à calculer. Le détail par segment reste en toutes lettres dans la légende :
// rien ici ne dépend d'un survol, qui ne déclenche rien au doigt.
const Anneau = ({ segments, total, centre }) => {
  let angle = 0;
  const tranches = segments.map(([, valeur, couleur]) => {
    const debut = angle;
    angle += total ? (valeur / total) * 360 : 0;
    return `${couleur} ${debut}deg ${angle}deg`;
  });
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{
        width: 92, height: 92, borderRadius: "50%", flexShrink: 0,
        background: segments.length ? `conic-gradient(${tranches.join(", ")})` : bdr,
      }}>
        <div style={{
          width: 60, height: 60, margin: 16, borderRadius: "50%", background: card,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ color: txt, fontSize: "var(--t-corps)", fontWeight: 700 }}>{total}</div>
          {centre && <div style={{ color: mut, fontSize: "var(--t-legende)" }}>{centre}</div>}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 140 }}>
        {segments.map(([label, valeur, couleur]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: couleur, flexShrink: 0 }} />
            <span style={{ color: txt, fontSize: "var(--t-petit)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
            <span style={{ color: mut, fontSize: "var(--t-legende)", flexShrink: 0 }}>{valeur} · {total ? Math.round((valeur / total) * 100) : 0} %</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Une jauge circulaire pour un taux d'achèvement : le pourcentage se lit dans
// l'anneau lui-même, ce qu'une barre linéaire de 4 px de haut ne rendait pas
// aussi lisible à côté de cinq autres.
const Jauge = ({ label, valeur, total }) => {
  const pct = total ? Math.round((valeur / total) * 100) : 0;
  const couleur = valeur === total ? ok : warn;
  const R = 26, C = 2 * Math.PI * R;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={R} fill="none" stroke={bdr} strokeWidth="6" />
        <circle cx="32" cy="32" r={R} fill="none" stroke={couleur} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C - (pct / 100) * C} transform="rotate(-90 32 32)" />
        <text x="32" y="37" textAnchor="middle" fontSize="13" fontWeight="700" fill={txt}>{pct}%</text>
      </svg>
      <span style={{ color: txt, fontSize: "var(--t-legende)", textAlign: "center", lineHeight: 1.3 }}>{label}</span>
      <span style={{ color: mut, fontSize: "var(--t-legende)" }}>{valeur === total ? "complet" : `${total - valeur} sans`}</span>
    </div>
  );
};

const Tuiles = ({ items }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--ecart-tap)", marginBottom: "var(--ecart-bloc)" }}>
    {items.map(([l, v, c]) => (
      <div key={l} style={{ background: card, border: `1px solid ${bdr}`, borderRadius: "var(--r-md)", padding: "10px 12px" }}>
        <div style={{ color: mut, fontSize: "var(--t-legende)", lineHeight: 1.3 }}>{l}</div>
        <div style={{ color: c, fontSize: "var(--t-chiffre)", fontWeight: 700, marginTop: 2 }}>{v}</div>
      </div>
    ))}
  </div>
);

// Une courbe plutôt que des barres, pour les mêmes séries temporelles :
// douze bâtons de la même famille montrent des quantités, une ligne montre en
// plus un mouvement — ça monte, ça baisse. Le survol qui donnait le détail
// d'un point ne déclenche rien au doigt ; la valeur reste donc en toutes
// lettres sous chaque point, comme elle l'était déjà au-dessus de chaque
// barre — un <span onClick> aurait résolu le même problème que le survol en
// recréant celui, déjà réglé ailleurs dans l'application, du <div onClick> :
// injoignable au clavier et muet pour un lecteur d'écran.
const Courbe = ({ donnees, couleur = accentFond, etiquette = (c) => c, periode }) => {
  const n = donnees.length;
  const max = Math.max(...donnees.map(([, v]) => v), 1);
  const x = (i) => (n > 1 ? ((i + 0.5) / n) * 100 : 50);
  const y = (v) => 96 - (v / max) * 88;
  const pts = donnees.map(([, v], i) => [x(i), y(v)]);

  return (
    <>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"
        style={{ width: "100%", height: 56, display: "block" }}>
        <polyline points={pts.map(([px, py]) => `${px},${py}`).join(" ")} fill="none" stroke={couleur} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {pts.map(([px, py], i) => <circle key={i} cx={px} cy={py} r="2" fill={couleur} />)}
      </svg>
      <div style={{ display: "flex", marginTop: 4 }}>
        {donnees.map(([cle, v]) => (
          <span key={cle} style={{ flex: 1, textAlign: "center", color: mut, fontSize: "var(--t-legende)" }}>{v || ""}</span>
        ))}
      </div>
      <div style={{ display: "flex" }}>
        {donnees.map(([cle]) => (
          <span key={cle} style={{ flex: 1, textAlign: "center", color: mut, fontSize: "var(--t-legende)" }}>{etiquette(cle)}</span>
        ))}
      </div>
      {/* Les douze colonnes ne portent que le mois : « 09 » deux fois dans
          l'année ne dit pas laquelle. L'année se lisait au survol — c'est-à-dire
          nulle part sur un téléphone. Elle se lit donc ici, une fois, au lieu
          de douze. */}
      {periode && (
        <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 4, textAlign: "center" }}>{periode}</div>
      )}
    </>
  );
};

// « 2025-10 » → « oct. 2025 », pour nommer les deux bouts d'une série de mois.
const moisLong = (cle) => {
  const [an, mois] = String(cle).split("-");
  const d = new Date(Number(an), Number(mois) - 1, 1);
  return Number.isNaN(d.getTime()) ? cle : d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
};
const periodeMois = (donnees) => (donnees.length > 1
  ? `${moisLong(donnees[0][0])} → ${moisLong(donnees[donnees.length - 1][0])}`
  : donnees.length ? moisLong(donnees[0][0]) : "");

// « 2026-09 » → « 09 ». Le mois seul suffit sur douze barres : l'année se lit
// au survol, et l'écrire douze fois mangerait la place des chiffres.
const moisCourt = (cle) => cle.slice(5);

// Les deux côtés reviennent à la ligne. Ils tenaient chacun sur une seule,
// ce qui allait tant que la droite était un nombre et la gauche un titre
// court : « cité par The Legend of Zelda: Breath of the Wild » a poussé la
// page entière hors de l'écran. Un titre de jeu n'a pas de longueur maximale,
// et le tronquer perdrait précisément l'information qu'on vient lire ici.
const Ligne = ({ gauche, droite, couleur = mut }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", padding: "6px 0", borderTop: `1px solid ${bdr}` }}>
    <span style={{ color: txt, fontSize: "var(--t-petit)", minWidth: 0, overflowWrap: "anywhere" }}>{gauche}</span>
    <span style={{ color: couleur, fontSize: "var(--t-legende)", textAlign: "right", minWidth: 0, overflowWrap: "anywhere" }}>{droite}</span>
  </div>
);

function Circulation({ games, jour }) {
  const s = useMemo(() => statsCirculation(games, jour), [games, jour]);

  if (s.total === 0) {
    return (
      <div style={{ textAlign: "center", color: mut, fontSize: "var(--t-petit)", padding: "40px 20px", lineHeight: 1.6 }}>
        Aucun prêt, ni en cours ni passé.<br />
        Les chiffres apparaîtront au premier jeu confié à quelqu'un.
      </div>
    );
  }

  return (
    <div>
      <Tuiles items={[
        ["Dehors", s.enCours, s.enCours ? warn : txt],
        ["En retard", s.enRetard, s.enRetard ? danger : txt],
        ["Jamais prêtés", s.jamaisPretes, txt],
      ]} />

      <Bloc titre="En résumé">
        <Ligne gauche="Prêts au total" droite={s.total} />
        <Ligne gauche="Sur les 12 derniers mois" droite={s.surUnAn} />
        <Ligne gauche="Durée moyenne d'un prêt" droite={`${s.dureeMoyenne} j`} />
        <Ligne gauche="Personnes différentes" droite={s.personnesDistinctes} />
        {s.rotation && (
          <Ligne gauche="Collection déjà sortie au moins une fois"
            droite={`${s.rotation.sortis} sur ${s.rotation.total} · ${s.rotation.pourcent} %`} />
        )}
        {s.record && (
          <Ligne
            gauche={`Le plus long : ${s.record.titre}`}
            droite={`${s.record.jours} j chez ${s.record.a}${s.record.enCours ? " (en cours)" : ""}`}
            couleur={s.record.jours > 90 ? warn : mut}
          />
        )}
      </Bloc>

      {/* Rendre à la date dite est une autre question que rendre vite : on peut
          garder un jeu trois mois sans être en retard si c'était convenu. */}
      {s.ponctualite && (
        <Bloc titre="Ponctualité">
          <Ligne gauche="Prêts avec une date convenue" droite={s.ponctualite.combien} />
          <Ligne gauche="Rendus à temps" droite={s.ponctualite.aLHeure} couleur={ok} />
          <Ligne gauche="Rendus en retard" droite={s.ponctualite.enRetard} couleur={s.ponctualite.enRetard ? danger : mut} />
          <Ligne gauche={s.ponctualite.ecartMoyen > 0 ? "Retard moyen" : "Avance moyenne"}
            droite={`${Math.abs(s.ponctualite.ecartMoyen)} j`}
            couleur={s.ponctualite.ecartMoyen > 0 ? warn : ok} />
          {s.ponctualite.pire && (
            <Ligne gauche={`Pire : ${s.ponctualite.pire.titre}`}
              droite={`${s.ponctualite.pire.jours} j de trop · ${s.ponctualite.pire.a}`} couleur={danger} />
          )}
          {/* La moyenne globale ci-dessus mélange qui rend toujours à temps et
              qui ne rend jamais dans les temps. À partir de deux personnes,
              cette liste dit qui est concerné. */}
          {s.ponctualite.parPersonne.length > 1 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${bdr}` }}>
              {s.ponctualite.parPersonne.map(p => (
                <Ligne key={p.nom} gauche={p.nom} droite={`${p.aLHeure} à temps · ${p.enRetard} en retard`}
                  couleur={p.enRetard > 0 ? warn : ok} />
              ))}
            </div>
          )}
          <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 8, lineHeight: 1.4 }}>
            Ne comptent que les prêts pour lesquels une date de retour avait été fixée.
          </div>
        </Bloc>
      )}

      {s.dehors.length > 0 && (
        <Bloc titre="Dehors en ce moment">
          {s.dehors.map(d => (
            <Ligne key={`${d.titre}-${d.a}`} gauche={`${d.titre} · ${d.a}`}
              droite={`${d.jours} j${d.prevu ? ` · à rendre le ${new Date(d.prevu).toLocaleDateString("fr-FR")}` : ""}`}
              couleur={d.prevu && d.prevu < new Date().toISOString().slice(0, 10) ? danger : d.jours > 60 ? warn : mut} />
          ))}
        </Bloc>
      )}

      <Bloc titre="Rythme des prêts">
        <Courbe donnees={s.parMois} couleur={warnFond} etiquette={moisCourt} periode={periodeMois(s.parMois)} />
        <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 8 }}>Prêts commencés, mois par mois, sur un an.</div>
        {/* Un total cumulé ne dit pas si le rythme accélère ou s'essouffle ;
            cette comparaison le dit. Rien à afficher avant deux ans d'usage. */}
        {s.evolutionPrets.delta !== null && (
          <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 4 }}>
            {s.evolutionPrets.delta > 0 ? "▲" : s.evolutionPrets.delta < 0 ? "▼" : "="} {Math.abs(s.evolutionPrets.delta)} %
            par rapport aux douze mois précédents ({s.evolutionPrets.actuel} contre {s.evolutionPrets.precedent}).
          </div>
        )}
      </Bloc>

      <Bloc titre="Qui emprunte">
        {s.emprunteurs.map(e => (
          <Barre key={e.nom} label={e.nom} valeur={e.prets} total={s.total} couleur={warnFond}
            suffixe={`${e.prets} prêt${e.prets > 1 ? "s" : ""} · ${e.moyenne} j en moyenne`} />
        ))}
        {/* Emprunter souvent et garder longtemps sont deux travers distincts. */}
        {s.lePlusLent && s.lePlusLent.moyenne > 0 && (
          <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${bdr}` }}>
            Garde le plus longtemps : <span style={{ color: txt }}>{s.lePlusLent.nom}</span>, {s.lePlusLent.moyenne} j en moyenne.
          </div>
        )}
      </Bloc>

      {s.plusPretes.length > 0 && (
        <Bloc titre="Les plus prêtés">
          {s.plusPretes.map(j => (
            <Ligne key={j.titre} gauche={j.titre} droite={`${j.fois} fois · ${j.jours} j`} />
          ))}
        </Bloc>
      )}

      {/* Ce qui part, vu autrement que jeu par jeu : une plateforme ou un
          genre peut sortir sans qu'aucun titre ne sorte deux fois. */}
      {s.parPlateforme.length > 0 && (
        <Bloc titre="Ce qui part">
          {s.parPlateforme.map(([p, n]) => (
            <Barre key={p} label={p} valeur={n} total={s.total} couleur={PLATFORM_COLORS[p] || accentFond}
              suffixe={`${n} prêt${n > 1 ? "s" : ""}`} />
          ))}
          {s.parGenre.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${bdr}` }}>
              {s.parGenre.map(([g, n]) => (
                <Barre key={g} label={g} valeur={n} total={s.total} couleur={warnFond} suffixe={`${n}`} />
              ))}
            </div>
          )}
        </Bloc>
      )}
    </div>
  );
}

// `estPC` : dans cet univers, trois des blocs de cet écran ne disent rien.
// Le format est constant — un jeu PC est forcé en démat à l'import —, et la
// plateforme aussi, ce qui donnait une barre unique à 100 % et des tuiles
// « 0 physique · 131 démat ». Ce qui varie sur PC, c'est la boutique, et c'est
// elle qui prend la place. Le reste — genres, notes, âge, séries, studios,
// ajouts, doublons, complétude — vaut dans les deux univers sans un mot de
// changement.
function Collection({ games, jour, estPC }) {
  const s = useMemo(() => statsCollection(games, jour), [games, jour]);
  if (s.total === 0) return <div style={{ textAlign: "center", color: mut, padding: "40px 0" }}>Bibliothèque vide</div>;
  const noteParSource = estPC ? s.noteParBoutique : s.noteParPlateforme;
  const genreDominantParSource = estPC ? s.genreDominantParBoutique : s.genreDominantParPlateforme;
  // Une boutique n'a pas de couleur dans le modèle, contrairement à une
  // plateforme : elle cycle sur la palette plutôt que de retomber toujours
  // sur le même aplat.
  const sourceEtCouleur = (estPC ? s.parBoutique : s.parPlateforme)
    .map(([p, n], i) => [p, n, estPC ? couleurCycle(i) : (PLATFORM_COLORS[p] || accentFond)]);

  return (
    <div>
      <Tuiles items={estPC
        ? [
            ["Total", s.total, accent],
            ["Boutiques", s.parBoutique.length, txt],
            ["Notés", s.note.combien, accent],
          ]
        : [
            ["Total", s.total, accent],
            ["Physiques", s.physique, txt],
            ["Démat", s.demat, accent],
          ]} />

      <Bloc titre={estPC ? "Par boutique" : "Par plateforme"}>
        <Anneau total={s.total} segments={sourceEtCouleur} />
        {/* Seuls les exemplaires physiques se prêtent : ce partage dit quelle
            part de la collection est concernée par le sujet de l'application.
            Côté PC il n'y en a aucun, et la ligne ne s'écrit pas. */}
        {s.physique > 0 && (
          <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 6, paddingTop: 8, borderTop: `1px solid ${bdr}` }}>
            {Math.round((s.physique / s.total) * 100)} % de la collection est prêtable.
          </div>
        )}
        {/* Les barres ci-dessus comptent chaque jeu une fois, sur la console
            pour laquelle il a été acheté. Ces lignes-ci disent l'autre vérité,
            celle du soir où l'on choisit quoi jouer : ce qui démarre sur la
            console qu'on a sous la main. */}
        {s.retrocompatibles.map(r => (
          <div key={r.parent} style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 6, lineHeight: 1.5 }}>
            Sur <span style={{ color: txt }}>{r.parent}</span> : {r.natifs} natif{r.natifs > 1 ? "s" : ""}
            {" "}et {r.herites} hérité{r.herites > 1 ? "s" : ""} de {r.enfant},
            soit <span style={{ color: txt, fontWeight: 600 }}>{r.jouables} jouables</span>.
          </div>
        ))}
      </Bloc>

      {s.note.combien > 0 && (
        <Bloc titre={`Notes — ${s.note.moyenne} de moyenne sur ${s.note.combien} jeu${s.note.combien > 1 ? "x" : ""}`}>
          <Anneau total={s.note.combien} centre="notés" segments={s.note.tranches} />
          {/* La moyenne se laisse tirer par deux bouses ; la médiane dit où se
              tient vraiment le milieu de la collection. */}
          <Ligne gauche="Médiane" droite={s.note.mediane} />
          {s.note.meilleur && <Ligne gauche={`↑ ${s.note.meilleur.titre}`} droite={s.note.meilleur.note} couleur={ok} />}
          {s.note.pire && <Ligne gauche={`↓ ${s.note.pire.titre}`} droite={s.note.pire.note} couleur={danger} />}
        </Bloc>
      )}

      {s.parGenre.length > 0 && (
        <Bloc titre="Genres">
          {s.parGenre.map(([g, n]) => <Barre key={g} label={g} valeur={n} total={s.total} />)}
        </Bloc>
      )}

      {(noteParSource.length > 0 || s.noteParGenre.length > 0) && (
        <Bloc titre="Où tu choisis le mieux">
          {/* Pas de couleur de plateforme ici : le rouge Switch, sur une ligne
              de texte, se lit comme une alerte alors qu'il n'est qu'une
              identité. Le vert et le rouge restent réservés au jugement.
              Sur PC, la moyenne par plateforme n'aurait qu'une ligne — « PC » —
              qui redit la moyenne générale : c'est la boutique qui distingue. */}
          {noteParSource.map(([p, note, n]) => (
            <Ligne key={`p${p}`} gauche={p} droite={`${note} de moyenne · ${n} notés`} />
          ))}
          {s.noteParGenre.map(([g, note, n]) => (
            <Ligne key={`g${g}`} gauche={g} droite={`${note} · ${n} jeux`} />
          ))}
          <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 8, lineHeight: 1.4 }}>
            Trois jeux notés au minimum : en dessous, une moyenne ne dit rien.
          </div>
        </Bloc>
      )}

      {/* Ce que valent tes choix, ci-dessus ; ce qu'ils SONT, ici. */}
      {genreDominantParSource.length > 0 && (
        <Bloc titre={estPC ? "Genre par boutique" : "Genre par plateforme"}>
          {genreDominantParSource.map(([source, genre, n, total]) => (
            <Ligne key={source} gauche={source} droite={`${genre} · ${n} sur ${total}`} />
          ))}
          <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 8, lineHeight: 1.4 }}>
            Trois jeux au minimum {estPC ? "par boutique" : "par plateforme"} : en dessous, un genre « dominant » n'est que le hasard d'un seul achat.
          </div>
        </Bloc>
      )}

      {s.modes.length > 0 && (
        <Bloc titre="Solo ou à plusieurs">
          {s.modes.map(([m, n]) => <Barre key={m} label={m} valeur={n} total={s.total} suffixe={`${n}`} />)}
        </Bloc>
      )}

      {s.formatParPlateforme.length > 1 && (
        <Bloc titre="Physique et démat">
          {s.formatParPlateforme.map(([p, phy, dem]) => (
            <Ligne key={p} gauche={p} droite={`${phy} physique${phy > 1 ? "s" : ""} · ${dem} démat`} />
          ))}
        </Bloc>
      )}

      {s.parDecennie.length > 0 && (
        <Bloc titre="L'âge des jeux">
          {s.parDecennie.map(([d, n]) => (
            <Barre key={d} label={`années ${d.slice(2)}`} valeur={n} total={s.total} suffixe={`${n}`} />
          ))}
          <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 8, lineHeight: 1.4 }}>
            D'après la date de sortie Wikidata, pas la date d'ajout : c'est l'âge du jeu, pas le tien dans la collection.
          </div>
        </Bloc>
      )}

      {/* Acheter au lancement ou attendre les soldes n'est pas une nuance : ça
          change le prix payé pour la même bibliothèque. */}
      {s.delaiAchat && (
        <Bloc titre="Quand tu achètes">
          <Ligne gauche="Délai médian entre la sortie et l'achat"
            droite={s.delaiAchat.median >= 365
              ? `${(s.delaiAchat.median / 365).toFixed(1)} an${s.delaiAchat.median >= 730 ? "s" : ""}`
              : `${s.delaiAchat.median} j`} />
          <Ligne gauche="Achetés dans les 3 mois" droite={s.delaiAchat.auLancement} couleur={ok} />
          <Ligne gauche="Achetés plus d'un an après" droite={s.delaiAchat.apresUnAn} />
          <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 8, lineHeight: 1.4 }}>
            Sur {s.delaiAchat.combien} jeu{s.delaiAchat.combien > 1 ? "x" : ""} dont on connaît la date de sortie.
          </div>
        </Bloc>
      )}

      {s.series.length > 0 && (
        <Bloc titre="Séries">
          {s.series.map(([nom, n]) => <Ligne key={nom} gauche={nom} droite={`${n} jeux`} />)}
        </Bloc>
      )}

      {(s.developpeurs.length > 0 || s.editeurs.length > 0) && (
        <Bloc titre="Studios et éditeurs">
          {s.developpeurs.map(([nom, n]) => <Ligne key={`d${nom}`} gauche={nom} droite={`${n} jeux`} />)}
          {s.editeurs.map(([nom, n]) => <Ligne key={`e${nom}`} gauche={nom} droite={`${n} édités`} />)}
        </Bloc>
      )}

      {s.parAnnee.length > 1 && (
        <Bloc titre="Ajouts par année">
          <Courbe donnees={s.parAnnee} etiquette={(an) => an.slice(2)} periode={s.parAnnee.length > 1 ? `${s.parAnnee[0][0]} → ${s.parAnnee[s.parAnnee.length - 1][0]}` : ""} />
        </Bloc>
      )}

      <Bloc titre="Ajouts sur 12 mois">
        <Courbe donnees={s.parMoisAjout} etiquette={moisCourt} periode={periodeMois(s.parMoisAjout)} />
        {s.evolutionAjouts.delta !== null && (
          <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 8 }}>
            {s.evolutionAjouts.delta > 0 ? "▲" : s.evolutionAjouts.delta < 0 ? "▼" : "="} {Math.abs(s.evolutionAjouts.delta)} %
            par rapport aux douze mois précédents ({s.evolutionAjouts.actuel} contre {s.evolutionAjouts.precedent}).
          </div>
        )}
      </Bloc>

      {s.doublons.length > 0 && (
        <Bloc titre="Doublons possibles">
          {s.doublons.map(d => (
            <Ligne key={d.titre} gauche={d.titre} droite={d.plateformes.join(" · ")}
              couleur={d.memePlateforme ? danger : mut} />
          ))}
          <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 8, lineHeight: 1.4 }}>
            Deux fiches sur des plateformes différentes, c'est normal. Deux fois la même plateforme, en rouge, est une saisie en double.
          </div>
        </Bloc>
      )}

      {s.seriesIncompletes.length > 0 && (
        <Bloc titre="Épisodes manquants">
          {s.seriesIncompletes.map(m => (
            <Ligne key={m.titre} gauche={m.titre}
              droite={`cité par ${m.depuis[0]}${m.depuis.length > 1 ? ` et ${m.depuis.length - 1} autre${m.depuis.length > 2 ? "s" : ""}` : ""}`} />
          ))}
          <div style={{ color: mut, fontSize: "var(--t-legende)", marginTop: 8, lineHeight: 1.4 }}>
            Des jeux que tes fiches Wikidata désignent comme épisode précédent ou suivant, et que tu n'as pas.
          </div>
        </Bloc>
      )}

      <Bloc titre="Ce qui manque">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))", gap: 10 }}>
          {s.completude.map(([label, n]) => (
            <Jauge key={label} label={label} valeur={n} total={s.total} />
          ))}
        </div>
      </Bloc>
    </div>
  );
}

// L'univers décide de ce qu'il y a à compter.
//
// Côté PC, « Circulation » n'a aucun objet : un jeu Steam ne se prête pas, et
// toutes ses tuiles, tous ses blocs parlent de prêts. C'est la même règle que
// l'onglet « Prêts » de la barre principale, qui disparaît déjà dans cet
// univers — un écran qui ne peut rien afficher vaut mieux absent que vide.
//
// Le sélecteur part avec lui : deux sous-onglets dont un seul existe, ce n'est
// plus un choix, c'est un bouton qui ne fait rien. `vue` n'est pas remis à
// zéro pour autant : en revenant sur Console, on retrouve l'onglet qu'on y
// regardait.
//
// Même raisonnement pour une bibliothèque qui n'a jamais rien prêté : toutes
// les tuiles de « Circulation » y valent zéro, et une page de zéros n'apprend
// rien qu'un onglet absent ne dise mieux. Le premier prêt la fait revenir.
export default function StatsView({ games, univers, aPrete }) {
  const estPC = univers === "pc";
  const sansCirculation = estPC || !aPrete;
  const [vue, setVue] = useState("circulation");
  // Les chiffres suivent la bibliothèque d'eux-mêmes : tout est recalculé dès
  // que `games` change. Ce qui se fige, c'est la date — les jours de prêt
  // écoulés et la fenêtre des douze mois sont lus au chargement de la page, et
  // une application laissée ouverte trois jours affiche encore l'avant-veille.
  //
  // Le bouton relit l'heure et la passe aux calculs : c'est la seule chose
  // qu'il puisse rafraîchir, parce que c'est la seule qui vieillit.
  const [calculLe, setCalculLe] = useState(() => Date.now());
  const jour = new Date(calculLe).toISOString().slice(0, 10);

  return (
    <div>
      {!sansCirculation && (
        <SousOnglets valeur={vue} onChange={setVue}
          options={[["circulation", "Circulation"], ["collection", "Collection"]]} />
      )}

      {vue === "circulation" && !sansCirculation
        ? <Circulation games={games} jour={jour} />
        : <Collection games={games} jour={jour} estPC={estPC} />}

      <button onClick={() => setCalculLe(Date.now())}
        style={{
          width: "100%", minHeight: "var(--tap)", marginTop: 4, background: "transparent",
          border: `1px solid ${bdr}`, borderRadius: "var(--r-md)", color: mut, fontSize: "var(--t-petit)",
          cursor: "pointer", fontFamily: "inherit",
        }}>↻ Recalculer</button>
      <div style={{ color: mut, fontSize: "var(--t-legende)", textAlign: "center", marginTop: 6, lineHeight: 1.5, opacity: 0.8 }}>
        Calculé à {new Date(calculLe).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.
        Les chiffres suivent la bibliothèque en direct ; seuls les jours écoulés se figent.
      </div>
    </div>
  );
}
