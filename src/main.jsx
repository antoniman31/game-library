import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { installerLiensExternes } from './lib/natif.js'

// Erreurs hors rendu (gestionnaires d'événements, promesses, code asynchrone) :
// le garde-fou React ne les voit pas, et sur Chrome mobile il n'y a pas de
// console pour les lire. Un bandeau les affiche donc à l'écran.
function bandeauErreur(texte) {
  const div = document.createElement("div")
  div.style.cssText =
    "position:fixed; top:0; left:0; right:0; z-index:99999; background:#b91c1c;" +
    "color:#fff; padding:calc(10px + env(safe-area-inset-top,0px)) 12px 10px;" +
    "font:12px/1.4 ui-monospace,monospace; white-space:pre-wrap; cursor:pointer"
  div.textContent = texte + "\n(toucher pour masquer)"
  div.onclick = () => div.remove()
  document.body.appendChild(div)
}

window.addEventListener("error", e => {
  bandeauErreur(`ERREUR : ${e.message}\n${e.filename || ""}:${e.lineno || "?"}`)
})
window.addEventListener("unhandledrejection", e => {
  bandeauErreur(`PROMESSE REJETÉE : ${e.reason?.message || e.reason}`)
})

// Dans l'application Android, un lien externe se chargerait DANS la WebView,
// qui devient alors un navigateur sans barre d'adresse dont on ne ressort pas.
// Posé ici, avant le premier rendu, l'écouteur couvre tous les liens de
// l'application — y compris ceux qu'on ajoutera plus tard. Sur le web, la
// fonction ne fait rien.
installerLiensExternes()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
