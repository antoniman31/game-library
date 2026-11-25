// La signature de Réglages › À propos (règle commune « Interface », 25/11/2026) : le logo AM.31, qui a fait l'appli, et quelle version
// tourne sur l'appareil. Le commit et la date viennent du build (vite.config.js) ; la date se lit en heure de Paris.

export const MENTION = 'Fait par AntoniMan31/Claude Code';

const JOUR_PARIS = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' });

export function versionTexte(commit, dateIso) {
  const version = typeof commit === 'string' && commit.trim() ? commit.trim() : 'inconnue';
  const date = new Date(typeof dateIso === 'string' ? dateIso : NaN);
  const jour = Number.isNaN(date.getTime()) ? '' : ` · ${JOUR_PARIS.format(date)}`;
  return `version ${version}${jour}`;
}

// Le logo alterne couleur de l'appli et bleu d'origine à un double clic. Un `dblclick` n'existe pas au doigt sur tous les navigateurs
// et ne se tape pas au clavier : on compte deux appuis rapprochés, ce qui marche pareil à la souris, au doigt et à Entrée.
export const DELAI_DOUBLE_CLIC_MS = 350;
export const estDoubleClic = (dernier, maintenant) => dernier > 0 && maintenant >= dernier && maintenant - dernier < DELAI_DOUBLE_CLIC_MS;
