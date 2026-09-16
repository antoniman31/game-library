import { Component } from "react";
import { enregistrerFichier } from "../lib/natif.js";

// Filet de sécurité autour de toute l'application.
//
// Sans lui, la moindre exception pendant un rendu démonte l'arbre React :
// #root se vide et il ne reste qu'une page blanche, sans un mot d'explication
// et sans console sur un téléphone. C'est exactement ce que produisait la
// variable `card` non déclarée de la modale d'ajout.
//
// La bibliothèque vivant uniquement dans le stockage local, l'écran d'erreur
// propose d'abord de l'exporter : une app cassée ne doit pas rendre les
// données inatteignables. L'export lit `localStorage` directement, puisque
// l'arbre React qui les détenait n'existe plus.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { erreur: null };
  }

  static getDerivedStateFromError(erreur) {
    return { erreur };
  }

  componentDidCatch(erreur, infos) {
    console.error("Erreur de rendu :", erreur, infos);
  }

  // L'export de secours passe par le même chemin que l'export ordinaire, et
  // pour la même raison : dans l'application Android, le lien invisible qu'on
  // clique ne fait rien. C'est ici que ça comptait le plus — cet écran ne
  // s'affiche que quand l'application est déjà tombée, et ce bouton est alors
  // le seul moyen de sortir la bibliothèque.
  exporter = async () => {
    try {
      const brut = localStorage.getItem("gl_v2") || "[]";
      const nom = `game-library-secours-${new Date().toISOString().slice(0, 10)}.json`;
      await enregistrerFichier(nom, brut);
    } catch (e) {
      console.error("Export de secours impossible :", e);
    }
  };

  render() {
    if (!this.state.erreur) return this.props.children;
    const btn = {
      minHeight: "var(--tap)", borderRadius: "var(--r-md)", padding: "0 16px",
      fontSize: "var(--t-corps)", fontWeight: 600, cursor: "pointer",
    };
    return (
      <div style={{ padding: "calc(40px + var(--safe-top)) 20px 40px", maxWidth: 520, margin: "0 auto" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>💥</div>
        <h1 style={{ color: "var(--txt)", fontSize: "var(--t-chiffre)", margin: "0 0 8px" }}>L'application s'est arrêtée</h1>
        <p style={{ color: "var(--mut)", fontSize: "var(--t-corps)", lineHeight: 1.5, margin: "0 0 12px" }}>
          Ta bibliothèque est intacte dans le stockage de cet appareil. Exporte-la
          avant toute chose, puis recharge la page.
        </p>
        <pre
          style={{
            background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: "var(--r-md)",
            padding: "10px 12px", color: "var(--danger)", fontSize: "var(--t-legende)", lineHeight: 1.45,
            whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "0 0 16px",
          }}
        >
          {String(this.state.erreur?.message || this.state.erreur)}
        </pre>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={this.exporter} style={{ ...btn, background: "var(--accent-fond)", border: "none", color: "#fff" }}>
            ⬇ Exporter ma bibliothèque
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{ ...btn, background: "transparent", border: "1px solid var(--bdr)", color: "var(--txt)" }}
          >
            Recharger
          </button>
        </div>
      </div>
    );
  }
}
