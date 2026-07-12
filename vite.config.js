import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// SteamGridDB n'autorise pas les appels navigateur (pas d'en-têtes CORS).
// On passe donc par un proxy du serveur de dev : le navigateur appelle /sgdb/*
// (même origine), Vite relaie vers l'API en injectant le token Authorization.
const SGDB_KEY = 'CLE_SGDB_RETIREE_DE_L_HISTORIQUE'

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
    },
  },
})
