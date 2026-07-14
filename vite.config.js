import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// SteamGridDB et xbl.io n'autorisent pas les appels navigateur (pas d'en-têtes CORS).
// On passe donc par un proxy du serveur de dev : le navigateur appelle /sgdb/* ou /xbl/*
// (même origine), Vite relaie vers l'API en injectant le token côté serveur.
const SGDB_KEY = 'CLE_SGDB_RETIREE_DE_L_HISTORIQUE'
const XBL_KEY = 'CLE_XBL_RETIREE_DE_L_HISTORIQUE'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sgdb': {
        target: 'https://www.steamgriddb.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/sgdb/, '/api/v2'),
        headers: { Authorization: `Bearer ${SGDB_KEY}` },
      },
      '/xbl': {
        target: 'https://xbl.io',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/xbl/, '/api/v2'),
        headers: { 'X-Authorization': XBL_KEY },
      },
    },
  },
})
