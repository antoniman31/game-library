import { useMemo, useState } from "react";
import { card, bdr, txt, mut } from "../lib/theme.js";
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

// Trois séries temporelles partagent désormais cette forme. Une barre à zéro
// garde deux pixels de gris : sans elle, un mois vide disparaît et l'axe ment.
const Histogramme = ({ donnees, couleur = "#5493FF", etiquette = (c) => c }) => {
  const max = Math.max(...donnees.map(([, n]) => n), 1);
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 70 }}>
      {donnees.map(([cle, n]) => (
        <div key={cle} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <span style={{ color: mut, fontSize: 9 }}>{n || ""}</span>
          <div title={`${cle} : ${n}`} style={{ width: "100%", height: `${Math.max(2, (n / max) * 42)}px`, background: n ? couleur : bdr, borderRadius: "2px 2px 0 0" }} />
          <span style={{ color: mut, fontSize: 9 }}>{etiquette(cle)}</span>
        </div>
      ))}
    </div>
  );
};

// « 2026-09 » → « 09 ». Le mois seul suffit sur douze barres : l'année se lit
// au survol, et l'écrire douze fois mangerait la place des chiffres.
const moisCourt = (cle) => cle.slice(5);

const Ligne = ({ gauche, droite, couleur = mut }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", padding: "6px 0", borderTop: `1px solid ${bdr}` }}>
    <span style={{ color: txt, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{gauche}</span>
    <span style={{ color: couleur, fontSize: 11, flexShrink: 0 }}>{droite}</span>
  </div>
);

function Circulation({ games, jour }) {
  const s = useMemo(() => statsCirculation(games, jour), [games, jour]);

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
        <Ligne gauche="Personnes différentes" droite={s.personnesDistinctes} />
        {s.rotation && (
          <Ligne gauche="Collection déjà sortie au moins une fois"
            droite={`${s.rotation.sortis} sur ${s.rotation.total} · ${s.rotation.pourcent} %`} />
        )}
        {s.record && (
          <Ligne
            gauche={`Le plus long : ${s.record.titre}`}
            droite={`${s.record.jours} j chez ${s.record.a}${s.record.enCours ? " (en cours)" : ""}`}
            couleur={s.record.jours > 90 ? "#f59e0b" : mut}
          />
        )}
      </Bloc>

      {/* Rendre à la date dite est une autre question que rendre vite : on peut
          garder un jeu trois mois sans être en retard si c'était convenu. */}
      {s.ponctualite && (
        <Bloc titre="Ponctualité">
          <Ligne gauche="Prêts avec une date convenue" droite={s.ponctualite.combien} />
          <Ligne gauche="Rendus à temps" droite={s.ponctualite.aLHeure} couleur="#22c55e" />
          <Ligne gauche="Rendus en retard" droite={s.ponctualite.enRetard} couleur={s.ponctualite.enRetard ? "#ef4444" : mut} />
          <Ligne gauche={s.ponctualite.ecartMoyen > 0 ? "Retard moyen" : "Avance moyenne"}
            droite={`${Math.abs(s.ponctualite.ecartMoyen)} j`}
            couleur={s.ponctualite.ecartMoyen > 0 ? "#f59e0b" : "#22c55e"} />
          {s.ponctualite.pire && (
            <Ligne gauche={`Pire : ${s.ponctualite.pire.titre}`}
              droite={`${s.ponctualite.pire.jours} j de trop · ${s.ponctualite.pire.a}`} couleur="#ef4444" />
          )}
          <div style={{ color: mut, fontSize: 10, marginTop: 8, lineHeight: 1.4 }}>
            Ne comptent que les prêts pour lesquels une date de retour avait été fixée.
          </div>
        </Bloc>
      )}

      {s.dehors.length > 0 && (
        <Bloc titre="Dehors en ce moment">
          {s.dehors.map(d => (
            <Ligne key={`${d.titre}-${d.a}`} gauche={`${d.titre} · ${d.a}`}
              droite={`${d.jours} j${d.prevu ? ` · à rendre le ${new Date(d.prevu).toLocaleDateString("fr-FR")}` : ""}`}
              couleur={d.prevu && d.prevu < new Date().toISOString().slice(0, 10) ? "#ef4444" : d.jours > 60 ? "#f59e0b" : mut} />
          ))}
        </Bloc>
      )}

      <Bloc titre="Rythme des prêts">
        <Histogramme donnees={s.parMois} couleur="#f59e0b" etiquette={moisCourt} />
        <div style={{ color: mut, fontSize: 10, marginTop: 8 }}>Prêts commencés, mois par mois, sur un an.</div>
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

      {/* Ce qui part, vu autrement que jeu par jeu : une plateforme ou un
          genre peut sortir sans qu'aucun titre ne sorte deux fois. */}
      {s.parPlateforme.length > 0 && (
        <Bloc titre="Ce qui part">
          {s.parPlateforme.map(([p, n]) => (
            <Barre key={p} label={p} valeur={n} total={s.total} couleur={PLATFORM_COLORS[p] || "#5493FF"}
              suffixe={`${n} prêt${n > 1 ? "s" : ""}`} />
          ))}
          {s.parGenre.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${bdr}` }}>
              {s.parGenre.map(([g, n]) => (
                <Barre key={g} label={g} valeur={n} total={s.total} couleur="#f59e0b" suffixe={`${n}`} />
              ))}
            </div>
          )}
        </Bloc>
      )}
    </div>
  );
}

function Collection({ games, jour }) {
  const s = useMemo(() => statsCollection(games, jour), [games, jour]);
  if (s.total === 0) return <div style={{ textAlign: "center", color: mut, padding: "40px 0" }}>Bibliothèque vide</div>;

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
          {/* La moyenne se laisse tirer par deux bouses ; la médiane dit où se
              tient vraiment le milieu de la collection. */}
          <Ligne gauche="Médiane" droite={s.note.mediane} />
          {s.note.meilleur && <Ligne gauche={`↑ ${s.note.meilleur.titre}`} droite={s.note.meilleur.note} couleur="#22c55e" />}
          {s.note.pire && <Ligne gauche={`↓ ${s.note.pire.titre}`} droite={s.note.pire.note} couleur="#ef4444" />}
        </Bloc>
      )}

      {s.parGenre.length > 0 && (
        <Bloc titre="Genres">
          {s.parGenre.map(([g, n]) => <Barre key={g} label={g} valeur={n} total={s.total} />)}
        </Bloc>
      )}

      {(s.noteParPlateforme.length > 0 || s.noteParGenre.length > 0) && (
        <Bloc titre="Où tu choisis le mieux">
          {/* Pas de couleur de plateforme ici : le rouge Switch, sur une ligne
              de texte, se lit comme une alerte alors qu'il n'est qu'une
              identité. Le vert et le rouge restent réservés au jugement. */}
          {s.noteParPlateforme.map(([p, note, n]) => (
            <Ligne key={`p${p}`} gauche={p} droite={`${note} de moyenne · ${n} notés`} />
          ))}
          {s.noteParGenre.map(([g, note, n]) => (
            <Ligne key={`g${g}`} gauche={g} droite={`${note} · ${n} jeux`} />
          ))}
          <div style={{ color: mut, fontSize: 10, marginTop: 8, lineHeight: 1.4 }}>
            Trois jeux notés au minimum : en dessous, une moyenne ne dit rien.
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
          <div style={{ color: mut, fontSize: 10, marginTop: 8, lineHeight: 1.4 }}>
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
          <Ligne gauche="Achetés dans les 3 mois" droite={s.delaiAchat.auLancement} couleur="#22c55e" />
          <Ligne gauche="Achetés plus d'un an après" droite={s.delaiAchat.apresUnAn} />
          <div style={{ color: mut, fontSize: 10, marginTop: 8, lineHeight: 1.4 }}>
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
          <Histogramme donnees={s.parAnnee} etiquette={(an) => an.slice(2)} />
        </Bloc>
      )}

      <Bloc titre="Ajouts sur 12 mois">
        <Histogramme donnees={s.parMoisAjout} etiquette={moisCourt} />
      </Bloc>

      {s.doublons.length > 0 && (
        <Bloc titre="Doublons possibles">
          {s.doublons.map(d => (
            <Ligne key={d.titre} gauche={d.titre} droite={d.plateformes.join(" · ")}
              couleur={d.memePlateforme ? "#ef4444" : mut} />
          ))}
          <div style={{ color: mut, fontSize: 10, marginTop: 8, lineHeight: 1.4 }}>
            Deux fiches sur des plateformes différentes, c'est normal. Deux fois la même plateforme, en rouge, est une saisie en double.
          </div>
        </Bloc>
      )}

      {s.seriesIncompletes.length > 0 && (
        <Bloc titre="Épisodes manquants">
          {s.seriesIncompletes.map(m => (
            <Ligne key={m.titre} gauche={m.titre} droite={`cité par ${m.depuis.slice(0, 2).join(", ")}`} />
          ))}
          <div style={{ color: mut, fontSize: 10, marginTop: 8, lineHeight: 1.4 }}>
            Des jeux que tes fiches Wikidata désignent comme épisode précédent ou suivant, et que tu n'as pas.
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
      <SousOnglets valeur={vue} onChange={setVue}
        options={[["circulation", "Circulation"], ["collection", "Collection"]]} />

      {vue === "circulation"
        ? <Circulation games={games} jour={jour} />
        : <Collection games={games} jour={jour} />}

      <button onClick={() => setCalculLe(Date.now())}
        style={{
          width: "100%", minHeight: "var(--tap)", marginTop: 4, background: "transparent",
          border: `1px solid ${bdr}`, borderRadius: 10, color: mut, fontSize: 12,
          cursor: "pointer", fontFamily: "inherit",
        }}>↻ Recalculer</button>
      <div style={{ color: mut, fontSize: 10, textAlign: "center", marginTop: 6, lineHeight: 1.5, opacity: 0.8 }}>
        Calculé à {new Date(calculLe).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.
        Les chiffres suivent la bibliothèque en direct ; seuls les jours écoulés se figent.
      </div>
    </div>
  );
}
