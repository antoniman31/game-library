import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// SteamGridDB et xbl.io n'exposent pas de CORS. En production, l'application passe
// par le relais Cloudflare (voir worker/), dont l'URL se règle dans l'onglet ⚙️.
//
// En développement, ce proxy joue le même rôle pour éviter d'avoir à déployer le
// Worker : il RELAIE simplement la requête. Il ne contient aucune clé — celle-ci
// est envoyée par le client dans l'en-tête Authorization / X-Authorization,
// exactement comme vers le Worker.
export default defineConfig({
  base: '/game-library/',
  plugins: [react()],
  server: {
    proxy: {
      '/sgdb': {
        target: 'https://www.steamgriddb.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/sgdb/, '/api/v2'),
      },
      '/xbl': {
        target: 'https://xbl.io',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/xbl/, '/api/v2'),
      },
    },
  },
})
