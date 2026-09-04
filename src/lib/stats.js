// Calculs de l'onglet Stats. Purs, donc vérifiables sans DOM ni navigateur.
//
// L'onglet se limitait à trois chiffres et aux genres. Or l'application stocke
// beaucoup plus que ce qu'elle montrait : les plateformes, les formats, la
// rétrocompatibilité, les notes, les dates d'ajout, et tout le bloc Wikidata
// (développeur, éditeur, série) qui n'était affiché que fiche par fiche et
// jamais agrégé.
//
// Deux familles, deux sous-onglets : ce qui circule, et ce qu'on possède.

import { dureeEntreeHistorique, aujourdhuiISO, pretEnRetard, BACK_COMPAT_PARENT, normTitle } from "./model.js";

const compter = (paires) => {
  const m = new Map();
  for (const c of paires) m.set(c, (m.get(c) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
};

// Les douze derniers mois en clés ISO « AAAA-MM », mois vides compris — sans
// eux, une courbe resserre le temps et invente une régularité qui n'a pas eu
// lieu. Le formatage reste à l'affichage : ce module ne connaît pas le
// français.
export function douzeDerniersMois(dates, aujourdhui = aujourdhuiISO()) {
  const [an, mois] = aujourdhui.split("-").map(Number);
  const m = new Map();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(an, mois - 1 - i, 1));
    m.set(d.toISOString().slice(0, 7), 0);
  }
  for (const d of dates) {
    const cle = String(d || "").slice(0, 7);
    if (m.has(cle)) m.set(cle, m.get(cle) + 1);
  }
  return [...m.entries()];
}

// La médiane dit ce que la moyenne cache : deux bouses et un chef-d'œuvre
// donnent la même moyenne qu'une collection sans relief.
export function mediane(nombres) {
  if (!nombres.length) return 0;
  const t = [...nombres].sort((a, b) => a - b);
  const i = Math.floor(t.length / 2);
  return t.length % 2 ? t[i] : Math.round((t[i - 1] + t[i]) / 2);
}

const joursEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

// Math.round arrondit vers le haut : −0,5 devient −0 quand +0,5 devient 1.
// Sur un écart de retard, ce biais fait systématiquement pencher la moyenne du
// côté du retard. Cet arrondi-ci est symétrique.
const arrondiSymetrique = (n) => (n < 0 ? -Math.round(-n) : Math.round(n));

// ── Circulation ────────────────────────────────────────────────────────────
// Un prêt en cours compte comme les prêts rendus : l'historique vient d'être
// créé, il est vide, et des blocs qui n'afficheraient rien pendant des mois
// n'auraient aucune raison d'exister.
export function lignesDePret(games, aujourdhui = aujourdhuiISO()) {
  const lignes = [];
  for (const g of games || []) {
    for (const e of g.pretsPasses || []) {
      lignes.push({ ...e, prevu: e.prevu || null, titre: g.title, id: g.id, plateforme: g.platform, genres: g.genre || [], enCours: false });
    }
    if (g.lentA && g.lentDate) {
      lignes.push({ a: g.lentA, du: g.lentDate, au: aujourdhui, prevu: g.lentRetourPrevu || null,
        titre: g.title, id: g.id, plateforme: g.platform, genres: g.genre || [], enCours: true });
    }
  }
  return lignes;
}

export function statsCirculation(games, aujourdhui = aujourdhuiISO()) {
  const jeux = games || [];
  const lignes = lignesDePret(jeux, aujourdhui);
  const jours = lignes.map(dureeEntreeHistorique);

  // Un an glissant : dit si l'on prête plus ou moins qu'avant, ce qu'un total
  // cumulé depuis toujours ne peut pas dire.
  const ilYaUnAn = new Date(new Date(aujourdhui) - 365 * 86400000).toISOString().slice(0, 10);

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

  // A-t-il rendu quand il l'avait dit ? Seuls les prêts avec date convenue
  // peuvent répondre ; les entrées archivées avant qu'on la conserve n'en ont
  // pas, et sont exclues plutôt que comptées comme ponctuelles.
  //
  // Les prêts en cours sont exclus aussi : leur `au` vaut aujourd'hui, si bien
  // qu'un jeu encore dehors passait pour « rendu en retard » alors qu'il n'est
  // pas rendu du tout. Ceux-là sont déjà signalés en haut et dans « Dehors ».
  const avecDate = lignes.filter(l => l.prevu && !l.enCours);
  const ecarts = avecDate.map(l => joursEntre(l.prevu, l.au));
  const ponctualite = avecDate.length ? {
    combien: avecDate.length,
    aLHeure: ecarts.filter(e => e <= 0).length,
    enRetard: ecarts.filter(e => e > 0).length,
    // Négatif = rendu en avance. La moyenne des écarts, pas celle des retards :
    // rendre trois jours plus tôt compense un jour de trop.
    ecartMoyen: arrondiSymetrique(ecarts.reduce((a, b) => a + b, 0) / ecarts.length),
    pire: avecDate.length ? (() => {
      const i = ecarts.indexOf(Math.max(...ecarts));
      return ecarts[i] > 0 ? { titre: avecDate[i].titre, a: avecDate[i].a, jours: ecarts[i] } : null;
    })() : null,
  } : null;

  // Ce qui est dehors, du plus ancien au plus récent : « 3 prêtés » ne dit pas
  // lequel traîne depuis six mois.
  const dehors = lignes.filter(l => l.enCours)
    .map(l => ({ titre: l.titre, a: l.a, jours: dureeEntreeHistorique(l), prevu: l.prevu }))
    .sort((a, b) => b.jours - a.jours);

  const sortisAuMoinsUneFois = new Set(lignes.map(l => l.id)).size;

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
    ponctualite,
    dehors,
    parMois: douzeDerniersMois(lignes.map(l => l.du), aujourdhui),
    // Part de la collection déjà sortie au moins une fois : une bibliothèque
    // qui ne circule pas est une bibliothèque, pas un prêteur.
    rotation: jeux.length
      ? { sortis: sortisAuMoinsUneFois, total: jeux.length, pourcent: Math.round((sortisAuMoinsUneFois / jeux.length) * 100) }
      : null,
    personnesDistinctes: parPersonne.size,
    // Ce qui part, vu autrement que jeu par jeu.
    parPlateforme: compter(lignes.map(l => l.plateforme).filter(Boolean)),
    parGenre: compter(lignes.flatMap(l => l.genres)).slice(0, 6),
  };
}

// ── Collection ─────────────────────────────────────────────────────────────
// Les couleurs sont des jetons, pas des valeurs : ces tranches remplissent des
// barres, et le thème clair a besoin de les redéfinir. Écrites en dur, elles
// échappaient au thème — c'est tout le mal que ce module se donne à rester pur
// qui serait perdu si l'affichage devait les corriger après coup.
const TRANCHES = [
  ["90 et +", n => n >= 90, "var(--ok-fond)"],
  ["80 – 89", n => n >= 80 && n < 90, "var(--ok-fond)"],
  ["70 – 79", n => n >= 70 && n < 80, "var(--warn-fond)"],
  ["60 – 69", n => n >= 60 && n < 70, "var(--warn-fond)"],
  ["moins de 60", n => n < 60, "var(--danger-fond)"],
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

// Date de sortie la plus ancienne connue pour un jeu : Wikidata en liste une
// par plateforme, et c'est la première qui date le jeu.
const sortieLaPlusAncienne = (g) => {
  const dates = (g.infobox?.releases || []).map(r => r?.date).filter(d => /^\d{4}/.test(d || ""));
  return dates.length ? dates.sort()[0] : null;
};

// Un titre référencé par un jeu de la collection mais absent d'elle : le tome
// manquant. Comparaison sur le titre normalisé, seul lien dont on dispose —
// Wikidata donne des noms, pas des identifiants, dans ces deux champs.
export function seriesIncompletes(games) {
  const jeux = games || [];
  const presents = new Set(jeux.map(g => normTitle(g.title)).filter(Boolean));
  const manquants = new Map();
  for (const g of jeux) {
    for (const voisin of [g.infobox?.follows, g.infobox?.followedBy]) {
      const titre = String(voisin || "").trim();
      if (!titre || presents.has(normTitle(titre))) continue;
      const v = manquants.get(normTitle(titre)) || { titre, depuis: [] };
      if (!v.depuis.includes(g.title)) v.depuis.push(g.title);
      manquants.set(normTitle(titre), v);
    }
  }
  // Les plus cités d'abord : un titre réclamé par deux jeux de la collection
  // est plus sûrement un trou qu'un titre cité une seule fois.
  return [...manquants.values()].sort((a, b) => b.depuis.length - a.depuis.length).slice(0, 8);
}

// Deux fiches pour le même jeu. Sur deux plateformes, c'est voulu ; deux fois
// sur la même, c'est une saisie en double — la seule que l'application puisse
// affirmer être une erreur.
export function doublons(games) {
  const par = new Map();
  for (const g of games || []) {
    const c = normTitle(g.title);
    if (!c) continue;
    if (!par.has(c)) par.set(c, []);
    par.get(c).push(g);
  }
  return [...par.values()].filter(l => l.length > 1).map(l => ({
    titre: l[0].title,
    plateformes: l.map(g => g.platform),
    memePlateforme: new Set(l.map(g => g.platform)).size < l.length,
  })).sort((a, b) => Number(b.memePlateforme) - Number(a.memePlateforme));
}

// Moyenne des notes d'un groupe, quand le groupe en compte assez pour que la
// moyenne veuille dire quelque chose.
const moyenneParCle = (jeux, cle, minimum) => {
  const m = new Map();
  for (const g of jeux) {
    if (typeof g.metacritic !== "number" || !g.metacritic) continue;
    for (const k of [].concat(cle(g)).filter(Boolean)) {
      const v = m.get(k) || { notes: [] };
      v.notes.push(g.metacritic);
      m.set(k, v);
    }
  }
  return [...m.entries()]
    .filter(([, v]) => v.notes.length >= minimum)
    .map(([k, v]) => [k, Math.round(v.notes.reduce((a, b) => a + b, 0) / v.notes.length), v.notes.length])
    .sort((a, b) => b[1] - a[1]);
};

export function statsCollection(games, aujourdhui = aujourdhuiISO()) {
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
      mediane: mediane(notes),
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
    // Ce que valent tes choix, groupe par groupe. Trois jeux au minimum : en
    // dessous, la « moyenne » d'un genre est le hasard d'un seul achat.
    noteParPlateforme: moyenneParCle(jeux, g => g.platform, 3),
    noteParGenre: moyenneParCle(jeux, g => g.genre || [], 3).slice(0, 8),
    // L'âge des jeux, à ne pas confondre avec la date d'entrée chez toi.
    parDecennie: (() => {
      const d = jeux.map(sortieLaPlusAncienne).filter(Boolean)
        .map(date => `${date.slice(0, 3)}0`);
      return compter(d).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    })(),
    // Achètes-tu au lancement ou en solde ? L'écart médian entre la sortie du
    // jeu et son entrée dans la bibliothèque, pour les jeux qui savent les deux.
    delaiAchat: (() => {
      const ecarts = jeux.map(g => {
        const sortie = sortieLaPlusAncienne(g);
        if (!sortie || !/^\d{4}-\d{2}-\d{2}$/.test(g.addedDate || "")) return null;
        const j = joursEntre(sortie, g.addedDate);
        return j >= 0 ? j : null; // une entrée antérieure à la sortie est une date fausse
      }).filter(j => j !== null);
      if (!ecarts.length) return null;
      return {
        combien: ecarts.length,
        median: mediane(ecarts),
        auLancement: ecarts.filter(j => j <= 90).length,
        apresUnAn: ecarts.filter(j => j > 365).length,
      };
    })(),
    parMoisAjout: douzeDerniersMois(jeux.map(g => g.addedDate).filter(Boolean), aujourdhui),
    formatParPlateforme: [...new Set(jeux.map(g => g.platform).filter(Boolean))].map(p => [
      p,
      jeux.filter(g => g.platform === p && g.format === "physique").length,
      jeux.filter(g => g.platform === p && g.format === "démat").length,
    ]).sort((a, b) => (b[1] + b[2]) - (a[1] + a[2])),
    modes: compter(jeux.flatMap(g => g.infobox?.modes || [])).slice(0, 5),
    doublons: doublons(jeux),
    seriesIncompletes: seriesIncompletes(jeux),
    developpeurs: compter(jeux.flatMap(g => g.infobox?.developers || [])).filter(([, n]) => n > 1).slice(0, 6),
    editeurs: compter(jeux.flatMap(g => g.infobox?.publishers || [])).filter(([, n]) => n > 1).slice(0, 6),
    series: compter(jeux.map(g => g.infobox?.series).filter(Boolean)).filter(([, n]) => n > 1).slice(0, 6),
  };
}
