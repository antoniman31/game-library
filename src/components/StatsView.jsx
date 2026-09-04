import { useMemo, useState } from "react";
import { card, bdr, txt, mut } from "../lib/theme.js";
import { PLATFORM_COLORS } from "../lib/model.js";
import { statsCirculation, statsCollection } from "../lib/stats.js";

// L'onglet Stats montrait trois chiffres et les genres, alors que
// l'application stocke bien davantage. Deux sous-onglets, parce que les deux
// familles ne répondent pas à la même question : ce qui circule (qui a quoi,
// combien de temps) et ce qu'on possède (quoi, sur quoi, dans quel état).
//
// Chaque bloc disparaît quand il n'a rien à dire. Un « aucune donnée » répété
// six fois occupe autant de place qu'un vrai contenu et n'en apporte aucun.

const Bloc = ({ titre, children }) => (
  <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
    <div style={{ color: txt, fontWeight: 600, fontSize: 13, marginBottom: 10 }}>{titre}</div>
    {children}
  </div>
);

// Une ligne de comptage avec sa barre. Le dénominateur est passé
// explicitement : rapporter des genres à un total de jeux et des prêts à un
// total de prêts ne se compare pas.
const Barre = ({ label, valeur, total, couleur = "#5493FF", suffixe }) => (
  <div style={{ marginBottom: 8 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 3 }}>
      <span style={{ color: txt, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ color: mut, fontSize: 11, flexShrink: 0 }}>{suffixe ?? valeur}</span>
    </div>
    <div style={{ height: 4, background: bdr, borderRadius: 2 }}>
      <div style={{ width: `${total ? (valeur / total) * 100 : 0}%`, height: "100%", background: couleur, borderRadius: 2 }} />
    </div>
  </div>
);

const Tuiles = ({ items }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
    {items.map(([l, v, c]) => (
      <div key={l} style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 10, padding: "10px 12px" }}>
        <div style={{ color: mut, fontSize: 10, lineHeight: 1.3 }}>{l}</div>
        <div style={{ color: c, fontSize: 19, fontWeight: 700, marginTop: 2 }}>{v}</div>
      </div>
    ))}
  </div>
);

const Ligne = ({ gauche, droite, couleur = mut }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", padding: "6px 0", borderTop: `1px solid ${bdr}` }}>
    <span style={{ color: txt, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{gauche}</span>
    <span style={{ color: couleur, fontSize: 11, flexShrink: 0 }}>{droite}</span>
  </div>
);

function Circulation({ games }) {
  const s = useMemo(() => statsCirculation(games), [games]);

  if (s.total === 0) {
    return (
      <div style={{ textAlign: "center", color: mut, fontSize: 12, padding: "40px 20px", lineHeight: 1.6 }}>
        Aucun prêt, ni en cours ni passé.<br />
        Les chiffres apparaîtront au premier jeu confié à quelqu'un.
      </div>
    );
  }

  return (
    <div>
      <Tuiles items={[
        ["Dehors", s.enCours, s.enCours ? "#f59e0b" : txt],
        ["En retard", s.enRetard, s.enRetard ? "#ef4444" : txt],
        ["Jamais prêtés", s.jamaisPretes, txt],
      ]} />

      <Bloc titre="En résumé">
        <Ligne gauche="Prêts au total" droite={s.total} />
        <Ligne gauche="Sur les 12 derniers mois" droite={s.surUnAn} />
        <Ligne gauche="Durée moyenne d'un prêt" droite={`${s.dureeMoyenne} j`} />
        {s.record && (
          <Ligne
            gauche={`Le plus long : ${s.record.titre}`}
            droite={`${s.record.jours} j chez ${s.record.a}${s.record.enCours ? " (en cours)" : ""}`}
            couleur={s.record.jours > 90 ? "#f59e0b" : mut}
          />
        )}
      </Bloc>

      <Bloc titre="Qui emprunte">
        {s.emprunteurs.map(e => (
          <Barre key={e.nom} label={e.nom} valeur={e.prets} total={s.total} couleur="#f59e0b"
            suffixe={`${e.prets} prêt${e.prets > 1 ? "s" : ""} · ${e.moyenne} j en moyenne`} />
        ))}
        {/* Emprunter souvent et garder longtemps sont deux travers distincts. */}
        {s.lePlusLent && s.lePlusLent.moyenne > 0 && (
          <div style={{ color: mut, fontSize: 11, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${bdr}` }}>
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
    </div>
  );
}

function Collection({ games }) {
  const s = useMemo(() => statsCollection(games), [games]);
  if (s.total === 0) return <div style={{ textAlign: "center", color: mut, padding: "40px 0" }}>Bibliothèque vide</div>;

  const maxAnnee = Math.max(...s.parAnnee.map(([, n]) => n), 1);

  return (
    <div>
      <Tuiles items={[
        ["Total", s.total, "#5493FF"],
        ["Physiques", s.physique, txt],
        ["Démat", s.demat, "#5493FF"],
      ]} />

      <Bloc titre="Par plateforme">
        {s.parPlateforme.map(([p, n]) => (
          <Barre key={p} label={p} valeur={n} total={s.total} couleur={PLATFORM_COLORS[p] || "#5493FF"}
            suffixe={`${n} · ${Math.round((n / s.total) * 100)} %`} />
        ))}
        {/* Seuls les exemplaires physiques se prêtent : ce partage dit quelle
            part de la collection est concernée par le sujet de l'application. */}
        {s.physique > 0 && (
          <div style={{ color: mut, fontSize: 11, marginTop: 6, paddingTop: 8, borderTop: `1px solid ${bdr}` }}>
            {Math.round((s.physique / s.total) * 100)} % de la collection est prêtable.
          </div>
        )}
        {s.retrocompatibles.map(([parent, n]) => (
          <div key={parent} style={{ color: mut, fontSize: 11, marginTop: 4 }}>
            {n} jeu{n > 1 ? "x" : ""} jouable{n > 1 ? "s" : ""} sur {parent}.
          </div>
        ))}
      </Bloc>

      {s.note.combien > 0 && (
        <Bloc titre={`Notes — ${s.note.moyenne} de moyenne sur ${s.note.combien} jeu${s.note.combien > 1 ? "x" : ""}`}>
          {s.note.tranches.map(([label, n, couleur]) => (
            <Barre key={label} label={label} valeur={n} total={s.note.combien} couleur={couleur} />
          ))}
          {s.note.meilleur && <Ligne gauche={`↑ ${s.note.meilleur.titre}`} droite={s.note.meilleur.note} couleur="#22c55e" />}
          {s.note.pire && <Ligne gauche={`↓ ${s.note.pire.titre}`} droite={s.note.pire.note} couleur="#ef4444" />}
        </Bloc>
      )}

      {s.parGenre.length > 0 && (
        <Bloc titre="Genres">
          {s.parGenre.map(([g, n]) => <Barre key={g} label={g} valeur={n} total={s.total} />)}
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
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 70 }}>
            {s.parAnnee.map(([an, n]) => (
              <div key={an} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <span style={{ color: mut, fontSize: 9 }}>{n}</span>
                <div title={`${an} : ${n}`} style={{ width: "100%", height: `${(n / maxAnnee) * 42}px`, background: "#5493FF", borderRadius: "2px 2px 0 0" }} />
                <span style={{ color: mut, fontSize: 9 }}>{an.slice(2)}</span>
              </div>
            ))}
          </div>
        </Bloc>
      )}

      <Bloc titre="Ce qui manque">
        {s.completude.map(([label, n]) => (
          <Barre key={label} label={label} valeur={n} total={s.total}
            couleur={n === s.total ? "#22c55e" : "#f59e0b"}
            suffixe={n === s.total ? "complet" : `${s.total - n} sans`} />
        ))}
      </Bloc>
    </div>
  );
}

export default function StatsView({ games }) {
  const [vue, setVue] = useState("circulation");
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["circulation", "Circulation"], ["collection", "Collection"]].map(([k, l]) => (
          <button key={k} onClick={() => setVue(k)} aria-pressed={vue === k}
            style={{
              flex: 1, minHeight: "var(--tap)", borderRadius: 8, fontSize: 13, cursor: "pointer",
              fontWeight: vue === k ? 600 : 400,
              background: vue === k ? "#5493FF22" : "transparent",
              border: `1px solid ${vue === k ? "#5493FF" : bdr}`,
              color: vue === k ? "#5493FF" : mut,
            }}>{l}</button>
        ))}
      </div>
      {vue === "circulation" ? <Circulation games={games} /> : <Collection games={games} />}
    </div>
  );
}
