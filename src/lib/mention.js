// La mention de Réglages › À propos (règle commune « Interface », 25/11/2026) : qui a fait l'appli, et quelle version
// tourne sur l'appareil. Le commit et la date viennent du build (vite.config.js) ; la date se lit en heure de Paris.

export const MENTION = 'Fait par AntoniMan31/Claude Code';

const JOUR_PARIS = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' });

export function ligneVersion(commit, dateIso) {
  const version = typeof commit === 'string' && commit.trim() ? commit.trim() : 'inconnue';
  const date = new Date(typeof dateIso === 'string' ? dateIso : NaN);
  const jour = Number.isNaN(date.getTime()) ? '' : ` du ${JOUR_PARIS.format(date)}`;
  return `${MENTION} · version ${version}${jour}`;
}
