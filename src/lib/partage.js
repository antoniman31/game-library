// Une liste de jeux lisible par un humain qui n'a pas l'application.
//
// L'export JSON existait déjà, mais il sert à déménager une bibliothèque, pas à
// la montrer : personne ne choisit un jeu dans un objet à accolades. Ce texte-ci
// part dans une conversation — WhatsApp, SMS, mail — où il reste cherchable et
// citable, ce qu'un document joint n'est pas.
//
// Il n'a pas de sélecteur de plateforme : il exporte la liste qu'on a sous les
// yeux, donc celle que les filtres ont déjà composée. Choisir Switch puis
// partager donne les jeux Switch ; choisir « note ≥ 80 » donne les mieux notés.
// Un deuxième sélecteur aurait redit ce que le panneau des filtres dit mieux.

const PLATEFORME_INCONNUE = "Autres";

const dateFr = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("fr-FR");
};

// Le format est dit sur chaque ligne, et pas seulement pour faire joli : un jeu
// démat est attaché à un compte, personne ne peut l'emprunter. Sans la mention,
// la liste promet des jeux qu'on ne peut pas prêter.
//
// Les jeux prêtés y restent avec la date de retour convenue : les cacher
// donnerait à croire qu'on ne les possède pas, et dire « prêté » sans dire
// jusqu'à quand n'apprend pas si l'on peut espérer son tour.
// La note Metacritic n'y figure pas : elle sert à trier sa propre bibliothèque,
// pas à conseiller quelqu'un d'autre. Affichée, elle range les jeux qu'on prête
// en bons et en mauvais avant même qu'on les ait proposés.
export function ligneJeu(g) {
  const bouts = [String(g?.title || "").trim() || "Sans titre"];
  if (g?.format) bouts.push(String(g.format));
  if (g?.lentA) {
    const retour = g.lentRetourPrevu ? dateFr(g.lentRetourPrevu) : null;
    bouts.push(retour ? `prêté à ${g.lentA}, retour le ${retour}` : `prêté à ${g.lentA}`);
  }
  return `- ${bouts.join(" · ")}`;
}

export function texteListe(games, titre = "Ma ludothèque") {
  const jeux = Array.isArray(games) ? games : [];
  if (!jeux.length) return `${titre} — aucun jeu.`;

  const parPlateforme = new Map();
  for (const g of jeux) {
    const p = String(g?.platform || "").trim() || PLATEFORME_INCONNUE;
    if (!parPlateforme.has(p)) parPlateforme.set(p, []);
    parPlateforme.get(p).push(g);
  }

  const lignes = [`${titre} — ${jeux.length} jeu${jeux.length > 1 ? "x" : ""}`];
  // Les plateformes par ordre alphabétique, et les jeux par titre : la liste
  // que reçoit quelqu'un d'autre n'a aucune raison de suivre le tri qu'on
  // s'était choisi pour soi, qui peut être un tirage au hasard.
  for (const plateforme of [...parPlateforme.keys()].sort((a, b) => a.localeCompare(b, "fr"))) {
    const liste = parPlateforme.get(plateforme)
      .slice()
      .sort((a, b) => String(a?.title || "").localeCompare(String(b?.title || ""), "fr"));
    lignes.push("", `${plateforme} (${liste.length})`);
    for (const g of liste) lignes.push(ligneJeu(g));
  }

  const pretes = jeux.filter(g => g?.lentA).length;
  if (pretes) lignes.push("", `${pretes} jeu${pretes > 1 ? "x" : ""} déjà prêté${pretes > 1 ? "s" : ""} — dispo au retour.`);
  return lignes.join("\n");
}

// Le partage natif d'abord, le presse-papier ensuite. Retourne ce qui s'est
// passé plutôt que d'afficher quoi que ce soit : l'appelant sait où le dire.
export async function partagerTexte(texte, titre = "Ma ludothèque") {
  if (navigator.share) {
    try {
      await navigator.share({ title: titre, text: texte });
      return "partage";
    } catch (e) {
      // Fermer le menu de partage n'est pas un échec dont il faut se plaindre.
      if (e?.name === "AbortError") return "annule";
    }
  }
  try {
    await navigator.clipboard.writeText(texte);
    return "copie";
  } catch { return "echec"; }
}
