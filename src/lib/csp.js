// Politique de sécurité du contenu (CSP) du site publié, posée au moment de la construction (plugin Vite, build seulement).
//
// Pourquoi : l'app garde les clés d'API (⚙️ → Services) dans le stockage du navigateur et affiche des données venues d'API
// et de fichiers importés. Si l'une d'elles parvenait un jour à injecter du HTML, aucun script injecté ne doit pouvoir
// s'exécuter : seuls les fichiers du site et le script du thème, écrit dans index.html, sont autorisés. Ce dernier l'est
// par son empreinte, recalculée à chaque construction : le modifier ne demande rien à la main.
//
// Ce qu'elle ne fait pas : les images et les appels réseau restent ouverts à toute adresse https, parce que les jaquettes
// viennent de nombreux services (RAWG, SteamGridDB, Xbox, Wikipédia…) et que l'adresse du relais se choisit dans les
// réglages. L'APK n'en a pas (`--mode android`) : sa WebView n'a pas pu être essayée avec une CSP. Une dépendance npm compromise, elle, s'exécute comme le reste du site : c'est le rôle de Dependabot et de la
// relecture des mises à jour, pas de la CSP.
//
// En développement, Vite injecte ses propres scripts dans la page : pas de CSP, sinon `npm run dev` ne démarre plus.
import { createHash } from 'node:crypto';

// Un <script> sans attribut src : son contenu est exécuté tel quel, il lui faut une empreinte.
const SCRIPT_EN_LIGNE = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;

export function empreintes(html) {
  return [...html.matchAll(SCRIPT_EN_LIGNE)].map(
    ([, code]) => `'sha256-${createHash('sha256').update(code, 'utf8').digest('base64')}'`,
  );
}

export function politique(html) {
  return [
    "default-src 'self'",
    ["script-src 'self'", ...empreintes(html)].join(' '),
    "style-src 'self'",
    // Images importées en blob:, petites images de l'interface en data:.
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https:",
    "font-src 'self' data:",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

// Juste après <meta charset> : la politique doit précéder le premier script de la page pour s'y appliquer.
export function ajouterCsp(html) {
  if (/http-equiv="Content-Security-Policy"/i.test(html)) throw new Error('index.html porte déjà une CSP');
  const ancre = /<meta charset="[^"]*"\s*\/?>/i;
  if (!ancre.test(html)) throw new Error('balise <meta charset> introuvable : la CSP doit venir juste après');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${politique(html)}" />`;
  return html.replace(ancre, (m) => `${m}\n    ${meta}`);
}

// Le plugin Vite : construction seulement, après les autres transformations (la page est alors définitive).
export function pluginCsp() {
  return { name: 'csp', apply: 'build', transformIndexHtml: { order: 'post', handler: ajouterCsp } };
}
