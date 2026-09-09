import { useState } from "react";
import Sheet from "./Sheet.jsx";
import { card, bdr, txt, mut, accent, accentDoux, warn } from "../lib/theme.js";
import { PLATFORMS, BACK_COMPAT, SEUILS_NOTE, compterFiltres } from "../lib/model.js";

const ACCENT = accent;

// Le panneau des filtres, replié.
//
// Il montrait ses sept groupes dépliés : quarante boutons d'un coup, jusqu'à
// cinquante quand la liste des genres s'ouvrait. La loi de Hick dit ce qui se
// passe alors — on ne filtre plus, on renonce — et il fallait faire défiler
// pour découvrir qu'un filtre par mode de jeu existait.
//
// Chaque groupe tient désormais sur une ligne qui porte sa valeur courante, et
// s'ouvre au toucher. Cinq lignes au lieu de quarante boutons, et surtout on
// voit d'un coup d'œil TOUTES les dimensions disponibles et lesquelles sont
// déjà posées — ce que la version dépliée rendait impossible.
//
// Un seul groupe ouvert à la fois : deux ouverts ramènent le défilement, et
// filtrer par deux critères se fait de toute façon l'un après l'autre.

// La ligne d'un groupe replié. Séparée de la suivante par un filet et non par
// du vide : ces lignes sont de même nature et forment une liste — la loi de
// proximité veut qu'elles se lisent ensemble, contrairement aux blocs d'un
// écran qui défile.
function Groupe({ label, resume, actif, ouvert, onBascule, children }) {
  return (
    <div>
      <button
        onClick={onBascule}
        aria-expanded={ouvert}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          width: "100%", boxSizing: "border-box", minHeight: "var(--tap)",
          background: "transparent", border: "none", borderTop: `1px solid ${bdr}`,
          padding: "10px 2px", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
        }}
      >
        <span style={{ color: txt, fontSize: "var(--t-petit)", fontWeight: 600, flexShrink: 0 }}>{label}</span>
        <span style={{
          flex: 1, minWidth: 0, textAlign: "right",
          color: actif ? ACCENT : mut, fontSize: "var(--t-petit)", fontWeight: actif ? 600 : 400,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{resume}</span>
        <span style={{ color: mut, flexShrink: 0 }}>{ouvert ? "▾" : "▸"}</span>
      </button>
      {ouvert && <div style={{ padding: "2px 2px 14px" }}>{children}</div>}
    </div>
  );
}

// Une rangée d'options. `flex: 1` avec `minWidth` laisse deux ou trois boutons
// par ligne selon leur libellé, sans grille figée qui laisserait des trous.
function Puces({ options, value, onChange, colorOf, compact }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map(([k, l, compte]) => {
        const actif = value === k;
        const c = (colorOf && colorOf(k)) || ACCENT;
        return (
          <button
            key={k}
            onClick={() => onChange(k)}
            aria-pressed={actif}
            style={{
              flex: compact ? "0 0 auto" : 1, minWidth: compact ? 0 : 92, minHeight: "var(--tap)",
              background: actif ? (c === accent ? accentDoux : c + "22") : "transparent",
              border: `1px solid ${actif ? c : bdr}`,
              color: actif ? c : txt,
              borderRadius: "var(--r-sm)", padding: "6px 10px", fontSize: "var(--t-petit)",
              fontWeight: actif ? 600 : 400, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {l}
            {/* Le nombre disait « Plateforme 33 », qui se lit comme un nom.
                Atténué et détaché, il redevient ce qu'il est : un poids.
                L'espace est écrite et non seulement dessinée par la marge :
                sans elle, un lecteur d'écran annonce « Note21 ». */}
            {compte != null && (
              <>{" "}<span style={{ color: mut, fontWeight: 400, marginLeft: 4 }}>{compte}</span></>
            )}
          </button>
        );
      })}
    </div>
  );
}

const Aide = ({ children }) => (
  <div style={{ color: mut, fontSize: "var(--t-legende)", lineHeight: 1.4, marginBottom: 8 }}>{children}</div>
);

// Au-delà, la liste des genres cesse d'être un choix et devient un mur. Six,
// parce que la loi de Hick parle de cinq à sept options : les six premiers
// couvrent déjà les quatre cinquièmes d'une bibliothèque réelle, et la longue
// traîne se rejoint mieux par la recherche.
const GENRES_VISIBLES = 6;

export default function FiltersSheet({
  plat, setPlat, avecRetro, setAvecRetro, nbRetro, nbNatifs,
  pretFil, setPretFil, fmtFil, setFmtFil,
  genreFil, setGenreFil, modeFil, setModeFil, genres, sansMode,
  noteFil, setNoteFil, completFil, setCompletFil, aCompleter, fichesIncompletes,
  serieFil, setSerieFil, groupePar, setGroupePar,
  view, setView, onClose, resultats,
}) {
  // Tous les filtres, sans exception : oublier les nouveaux ici laisserait
  // « Réinitialiser » grisé alors qu'il y a bien quelque chose à réinitialiser.
  const actifs = compterFiltres({ plat, pretFil, fmtFil, genreFil, modeFil, noteFil, completFil, serieFil });
  const [ouvert, setOuvert] = useState(null);
  const [tousLesGenres, setTousLesGenres] = useState(false);

  // Le genre choisi reste visible même s'il est dans la traîne : sinon le
  // filtre actif disparaît de l'écran et on ne sait plus comment l'enlever.
  const visibles = tousLesGenres
    ? genres
    : genres.filter(([g], i) => i < GENRES_VISIBLES || g === genreFil);
  const caches = genres.length - visibles.length;

  const MODES = [["tous", "Tous"], ["solo", "Solo"], ["multi", "À plusieurs"], ["coop", "Coopératif"]];
  // Un seuil, pas des tranches : la question n'est pas « lesquels sont entre 80
  // et 89 » mais « qu'est-ce que j'ai de vraiment bien ».
  const NOTES = [["tous", "Toutes"], ...SEUILS_NOTE.map(n => [String(n), `${n} et +`])];
  const COMPLETUDE = [["tous", "Tous"], ...aCompleter.map(([cle, label, n]) => [cle, label, n])];
  const GROUPES = [["aucun", "Aucun"], ["plateforme", "Plateforme"], ["serie", "Série"], ["genre", "Genre"]];
  const PRETS = [["tous", "Tous"], ["chez moi", "🏠 Chez moi"], ["prêtés", "📤 Prêtés"]];
  const FORMATS = [["tous", "Tous"], ["physique", "Physique"], ["démat", "Démat"]];
  const PLATEFORMES = PLATFORMS.map(p => [p, p === "tous" ? "Toutes" : p]);

  const libelle = (options, valeur) => options.find(o => o[0] === valeur)?.[1] || valeur;
  const enfant = BACK_COMPAT[plat];
  const bascule = (cle) => () => setOuvert(o => (o === cle ? null : cle));

  return (
    <Sheet title="Filtres & affichage" onClose={onClose}>
      {/* Le seul filtre qui serve à FAIRE quelque chose plutôt qu'à regarder.
          Les autres répondent à « montre-moi » ; celui-ci répond à « qu'est-ce
          qu'il me reste à faire », et l'onglet Stats savait le compter depuis
          longtemps sans qu'on puisse y aller.
          Il est donc sorti de l'accordéon : un bouton qui doit dominer ne peut
          pas attendre derrière une ligne repliée. L'effet von Restorff ne joue
          que si un seul élément diffère — c'est le seul bloc plein du panneau,
          et il n'y en aura jamais deux.
          Il disparaît entièrement quand il n'y a plus rien à compléter : un
          appel à l'action sans action à faire est pire qu'une absence. */}
      {aCompleter.length > 0 && (
        <div style={{
          background: accentDoux, border: `2px solid ${ACCENT}`, borderRadius: "var(--r-md)",
          padding: 14, marginBottom: "var(--ecart-bloc)",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
            <span style={{ color: ACCENT, fontSize: "var(--t-corps)", fontWeight: 700 }}>À compléter</span>
            <span style={{ color: ACCENT, fontSize: "var(--t-petit)", flexShrink: 0 }}>
              {fichesIncompletes} fiche{fichesIncompletes > 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ color: mut, fontSize: "var(--t-legende)", lineHeight: 1.5, marginBottom: 10 }}>
            Les fiches auxquelles il manque quelque chose. Choisis un manque, la liste
            ne montre plus qu'elles — et l'option s'efface dès qu'il n'en reste aucune.
          </div>
          <Puces compact options={COMPLETUDE} value={completFil} onChange={setCompletFil} />
        </div>
      )}

      {/* Le résumé dit « seul » quand la case est décochée : c'est tout
          l'intérêt d'une ligne repliée que d'annoncer ce qu'elle fait, et un
          filtre plus étroit que la normale doit se voir sans être ouvert. */}
      <Groupe label="Plateforme" actif={plat !== "tous"}
        resume={libelle(PLATEFORMES, plat) + (enfant && !avecRetro ? " seul" : "")}
        ouvert={ouvert === "plat"} onBascule={bascule("plat")}>
        <Puces options={PLATEFORMES} value={plat} onChange={setPlat} />
        {/* La question ne se pose que pour une console qui en accueille une
            autre : « Xbox One » ou « Switch 1 » n'ont rien à hériter. */}
        {enfant && (
          <label style={{
            display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer",
            minHeight: "var(--tap-min)", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${bdr}`,
          }}>
            <input type="checkbox" checked={avecRetro} onChange={e => setAvecRetro(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18, accentColor: ACCENT, flexShrink: 0 }} />
            {/* Le libellé ne nomme plus la console héritée : il est le même
                pour la Xbox et pour la Switch, donc il se reconnaît d'une
                console à l'autre au lieu de se relire. Les noms et les nombres
                descendent d'une ligne, là où va le détail. */}
            <span>
              <span style={{ color: txt, fontSize: "var(--t-petit)", fontWeight: 600 }}>
                Inclure les jeux rétrocompatibles
              </span>
              <span style={{ display: "block", color: mut, fontSize: "var(--t-legende)", lineHeight: 1.5, marginTop: 2 }}>
                {nbRetro > 0
                  ? `${nbRetro} jeu${nbRetro > 1 ? "x" : ""} ${enfant} démarre${nbRetro > 1 ? "nt" : ""} sur ${plat}. Décoche pour ne voir que ${nbNatifs > 1 ? `les ${nbNatifs} jeux` : nbNatifs === 1 ? "le seul jeu" : "les jeux"} vraiment ${plat}.`
                  : `Aucun jeu ${enfant} n'est marqué rétrocompatible pour l'instant.`}
              </span>
            </span>
          </label>
        )}
      </Groupe>

      {/* Le groupe Statut a laissé la place au seul état que l'application
          suit encore : le jeu est-il ici, ou chez quelqu'un ? */}
      <Groupe label="Prêt" resume={libelle(PRETS, pretFil)} actif={pretFil !== "tous"}
        ouvert={ouvert === "pret"} onBascule={bascule("pret")}>
        <Puces options={PRETS} value={pretFil} onChange={setPretFil}
          colorOf={k => (k === "prêtés" ? warn : ACCENT)} />
      </Groupe>

      <Groupe label="Format" resume={libelle(FORMATS, fmtFil)} actif={fmtFil !== "tous"}
        ouvert={ouvert === "format"} onBascule={bascule("format")}>
        <Puces options={FORMATS} value={fmtFil} onChange={setFmtFil} />
      </Groupe>

      {/* « On est deux ce soir, on lance quoi ? » — la question que cent
          cinquante jeux rendent difficile, et à laquelle Wikidata répondait
          déjà sans qu'on puisse le lui demander. */}
      <Groupe label="Mode de jeu" resume={libelle(MODES, modeFil)} actif={modeFil !== "tous"}
        ouvert={ouvert === "mode"} onBascule={bascule("mode")}>
        {sansMode > 0 && (
          <Aide>
            D'après la fiche Wikidata. {sansMode} jeu{sansMode > 1 ? "x n'en ont" : " n'en a"} pas
            et ne {sansMode > 1 ? "sortiront" : "sortira"} d'aucun de ces choix.
          </Aide>
        )}
        <Puces options={MODES} value={modeFil} onChange={setModeFil} />
      </Groupe>

      {genres.length > 0 && (
        <Groupe label="Genre" resume={genreFil === "tous" ? "Tous" : genreFil} actif={genreFil !== "tous"}
          ouvert={ouvert === "genre"} onBascule={bascule("genre")}>
          <Puces compact value={genreFil} onChange={setGenreFil}
            options={[["tous", "Tous"], ...visibles.map(([g, n]) => [g, g, n])]} />
          {caches > 0 && (
            <button
              onClick={() => setTousLesGenres(true)}
              style={{
                minHeight: "var(--tap-min)", marginTop: 8, padding: "0 12px",
                background: "transparent", border: `1px solid ${bdr}`, color: mut,
                borderRadius: "var(--r-sm)", fontSize: "var(--t-legende)",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Tous les genres ({genres.length})
            </button>
          )}
        </Groupe>
      )}

      <Groupe label="Note" resume={libelle(NOTES, noteFil)} actif={noteFil !== "tous"}
        ouvert={ouvert === "note"} onBascule={bascule("note")}>
        <Puces options={NOTES} value={noteFil} onChange={setNoteFil} />
      </Groupe>

      {/* Cinquante-huit séries ne tiennent pas dans une grille de boutons : ce
          filtre se pose depuis une fiche, en touchant le nom de la série. Le
          groupe n'existe donc que pour montrer celui qui est posé et permettre
          de l'enlever — sans quoi on ne saurait plus comment revenir. */}
      {serieFil !== "tous" && (
        <Groupe label="Série" resume={serieFil} actif
          ouvert={ouvert === "serie"} onBascule={bascule("serie")}>
          <Aide>Posée depuis une fiche de jeu, en touchant le nom de la série.</Aide>
          <Puces compact value={serieFil} onChange={setSerieFil}
            options={[["tous", "Toutes les séries"], [serieFil, serieFil]]} />
        </Groupe>
      )}

      {/* L'affichage n'est pas un filtre, mais il ne coûte qu'une ligne : le
          replier pour économiser deux boutons ferait payer un toucher de plus
          ce qui tient déjà sur une rangée. Il reste donc déplié, séparé de
          l'accordéon par un vrai blanc. */}
      <div style={{ marginTop: "var(--ecart-bloc)", paddingTop: 2 }}>
        <div style={{ color: mut, fontSize: "var(--t-legende)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 7 }}>
          Affichage
        </div>
        <Puces options={[["liste", "☰ Liste"], ["compact", "≡ Compacte"], ["grille", "⊞ Grille"]]}
          value={view} onChange={setView} />

        <div style={{ color: mut, fontSize: "var(--t-legende)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", margin: "16px 0 7px" }}>
          Regrouper par
        </div>
        <Puces options={GROUPES} value={groupePar} onChange={setGroupePar} />
      </div>

      {/* Collée au bas de la feuille : dépliés, les genres repoussaient « Voir
          N jeux » sous plusieurs écrans de défilement, alors que c'est le
          bouton qui dit en direct combien de jeux il reste. Le fond reprend
          celui du panneau, donc la liste passe dessous sans transparence. */}
      <div style={{
        display: "flex", gap: 8, alignItems: "center",
        position: "sticky", bottom: 0, background: card,
        paddingTop: 12, marginTop: 16, borderTop: `1px solid ${bdr}`,
      }}>
        <button
          onClick={() => {
            setPlat("tous"); setAvecRetro(true); setPretFil("tous"); setFmtFil("tous");
            setGenreFil("tous"); setModeFil("tous"); setNoteFil("tous");
            setCompletFil("tous"); setSerieFil("tous");
          }}
          disabled={actifs === 0}
          style={{
            flex: 1, minHeight: "var(--tap)", background: "transparent",
            border: `1px solid ${bdr}`, color: actifs ? txt : mut, borderRadius: "var(--r-sm)",
            fontSize: "var(--t-corps)", cursor: actifs ? "pointer" : "default", opacity: actifs ? 1 : 0.5,
            fontFamily: "inherit",
          }}
        >
          Réinitialiser
        </button>
        <button
          onClick={onClose}
          style={{
            flex: 2, minHeight: "var(--tap)", background: "var(--accent-fond)", border: "none",
            color: "#fff", borderRadius: "var(--r-sm)", fontSize: "var(--t-corps)",
            fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Voir {resultats} jeu{resultats > 1 ? "x" : ""}
        </button>
      </div>
    </Sheet>
  );
}
