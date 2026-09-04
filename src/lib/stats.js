// Calculs de l'onglet Stats. Purs, donc vérifiables sans DOM ni navigateur.
//
// L'onglet se limitait à trois chiffres et aux genres. Or l'application stocke
// beaucoup plus que ce qu'elle montrait : les plateformes, les formats, la
// rétrocompatibilité, les notes, les dates d'ajout, et tout le bloc Wikidata
// (développeur, éditeur, série) qui n'était affiché que fiche par fiche et
// jamais agrégé.
//
// Deux familles, deux sous-onglets : ce qui circule, et ce qu'on possède.

import { dureeEntreeHistorique, aujourdhuiISO, pretEnRetard, BACK_COMPAT_PARENT } from "./model.js";

const compter = (paires) => {
  const m = new Map();
  for (const c of paires) m.set(c, (m.get(c) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
};

// ── Circulation ────────────────────────────────────────────────────────────
// Un prêt en cours compte comme les prêts rendus : l'historique vient d'être
// créé, il est vide, et des blocs qui n'afficheraient rien pendant des mois
// n'auraient aucune raison d'exister.
export function lignesDePret(games) {
  const lignes = [];
  for (const g of games || []) {
    for (const e of g.pretsPasses || []) {
      lignes.push({ ...e, titre: g.title, id: g.id, enCours: false });
    }
    if (g.lentA && g.lentDate) {
      lignes.push({ a: g.lentA, du: g.lentDate, au: aujourdhuiISO(), titre: g.title, id: g.id, enCours: true });
    }
  }
  return lignes;
}

export function statsCirculation(games) {
  const jeux = games || [];
  const lignes = lignesDePret(jeux);
  const jours = lignes.map(dureeEntreeHistorique);

  // Un an glissant : dit si l'on prête plus ou moins qu'avant, ce qu'un total
  // cumulé depuis toujours ne peut pas dire.
  const ilYaUnAn = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);

  const parJeu = new Map();
  for (const l of lignes) {
    const v = parJeu.get(l.id) || { titre: l.titre, fois: 0, jours: 0 };
    v.fois++; v.jours += dureeEntreeHistorique(l);
    parJeu.set(l.id, v);
  }

  const parPersonne = new Map();
  for (const l of lignes) {
    const nom = l.a.trim();
    if (!nom) continue;
    const v = parPersonne.get(nom) || { nom, prets: 0, jours: 0 };
    v.prets++; v.jours += dureeEntreeHistorique(l);
    parPersonne.set(nom, v);
  }
  const personnes = [...parPersonne.values()].map(p => ({ ...p, moyenne: Math.round(p.jours / p.prets) }));

  const record = lignes.length
    ? lignes.reduce((a, b) => (dureeEntreeHistorique(b) > dureeEntreeHistorique(a) ? b : a))
    : null;

  return {
    total: lignes.length,
    enCours: jeux.filter(g => g.lentA).length,
    enRetard: jeux.filter(pretEnRetard).length,
    // Un jeu qui n'est jamais sorti : la moitié muette du sujet.
    jamaisPretes: jeux.filter(g => !g.lentA && !(g.pretsPasses || []).length).length,
    dureeMoyenne: jours.length ? Math.round(jours.reduce((a, b) => a + b, 0) / jours.length) : 0,
    surUnAn: lignes.filter(l => l.du >= ilYaUnAn).length,
    plusPretes: [...parJeu.values()].filter(v => v.fois > 1).sort((a, b) => b.fois - a.fois || b.jours - a.jours).slice(0, 6),
    emprunteurs: personnes.sort((a, b) => b.prets - a.prets || b.jours - a.jours).slice(0, 8),
    // Le plus fréquent et le plus lent ne sont pas la même personne.
    lePlusLent: personnes.length > 1 ? [...personnes].sort((a, b) => b.moyenne - a.moyenne)[0] : null,
    record: record ? { titre: record.titre, a: record.a, jours: dureeEntreeHistorique(record), enCours: record.enCours } : null,
  };
}

// ── Collection ─────────────────────────────────────────────────────────────
const TRANCHES = [
  ["90 et +", n => n >= 90, "#22c55e"],
  ["80 – 89", n => n >= 80 && n < 90, "#22c55e"],
  ["70 – 79", n => n >= 70 && n < 80, "#f59e0b"],
  ["60 – 69", n => n >= 60 && n < 70, "#f59e0b"],
  ["moins de 60", n => n < 60, "#ef4444"],
];

function anneesCompletes(annees) {
  if (!annees.length) return [];
  const m = new Map();
  for (const a of annees) m.set(a, (m.get(a) || 0) + 1);
  const nums = [...m.keys()].map(Number);
  const sortie = [];
  for (let a = Math.min(...nums); a <= Math.max(...nums); a++) sortie.push([String(a), m.get(String(a)) || 0]);
  return sortie;
}

export function statsCollection(games) {
  const jeux = games || [];
  const total = jeux.length;
  const notes_ = jeux.filter(g => typeof g.metacritic === "number" && g.metacritic > 0);
  const notes = notes_.map(g => g.metacritic);
  const parNote = [...notes_].sort((a, b) => b.metacritic - a.metacritic);

  // Combien de jeux d'une plateforme ancienne tournent sur la récente. La
  // donnée existait par jeu, elle n'était additionnée nulle part.
  const retro = compter(jeux
    .filter(g => g.backCompat && BACK_COMPAT_PARENT[g.platform])
    .map(g => BACK_COMPAT_PARENT[g.platform]));

  const annee = (d) => (/^\d{4}/.test(d || "") ? d.slice(0, 4) : null);

  return {
    total,
    physique: jeux.filter(g => g.format === "physique").length,
    demat: jeux.filter(g => g.format === "démat").length,
    parPlateforme: compter(jeux.map(g => g.platform).filter(Boolean)),
    retrocompatibles: retro,
    parGenre: compter(jeux.flatMap(g => g.genre || [])).slice(0, 8),
    note: {
      combien: notes.length,
      moyenne: notes.length ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length) : 0,
      meilleur: parNote[0] ? { titre: parNote[0].title, note: parNote[0].metacritic } : null,
      pire: parNote.length > 1 ? { titre: parNote[parNote.length - 1].title, note: parNote[parNote.length - 1].metacritic } : null,
      tranches: TRANCHES.map(([label, test, couleur]) => [label, notes.filter(test).length, couleur]).filter(([, n]) => n > 0),
    },
    // Ce qui manque, et donc ce qu'il reste à faire — la seule statistique
    // sur laquelle on puisse agir.
    completude: [
      ["Jaquette", jeux.filter(g => g.cover).length],
      ["Genre", jeux.filter(g => g.genre?.length).length],
      ["Description", jeux.filter(g => g.style).length],
      ["Note", notes.length],
      ["Fiche Wikidata", jeux.filter(g => g.infobox).length],
    ],
    // Les années sans aucun ajout doivent apparaître à zéro : sans elles,
    // l'histogramme resserre le temps et suggère un rythme régulier qui n'a
    // pas eu lieu.
    parAnnee: anneesCompletes(jeux.map(g => annee(g.addedDate)).filter(Boolean)),
    developpeurs: compter(jeux.flatMap(g => g.infobox?.developers || [])).filter(([, n]) => n > 1).slice(0, 6),
    editeurs: compter(jeux.flatMap(g => g.infobox?.publishers || [])).filter(([, n]) => n > 1).slice(0, 6),
    series: compter(jeux.map(g => g.infobox?.series).filter(Boolean)).filter(([, n]) => n > 1).slice(0, 6),
  };
}
