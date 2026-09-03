import { Component } from "react";

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

  exporter = () => {
    try {
      const brut = localStorage.getItem("gl_v2") || "[]";
      const url = URL.createObjectURL(new Blob([brut], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `game-library-secours-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export de secours impossible :", e);
    }
  };

  render() {
    if (!this.state.erreur) return this.props.children;
    const btn = {
      minHeight: "var(--tap)", borderRadius: 10, padding: "0 16px",
      fontSize: 13, fontWeight: 600, cursor: "pointer",
    };
    return (
      <div style={{ padding: "calc(40px + var(--safe-top)) 20px 40px", maxWidth: 520, margin: "0 auto" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>💥</div>
        <h1 style={{ color: "var(--txt)", fontSize: 18, margin: "0 0 8px" }}>L'application s'est arrêtée</h1>
        <p style={{ color: "var(--mut)", fontSize: 13, lineHeight: 1.5, margin: "0 0 12px" }}>
          Ta bibliothèque est intacte dans le stockage de cet appareil. Exporte-la
          avant toute chose, puis recharge la page.
        </p>
        <pre
          style={{
            background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 10,
            padding: "10px 12px", color: "#ef4444", fontSize: 11, lineHeight: 1.45,
            whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "0 0 16px",
          }}
        >
          {String(this.state.erreur?.message || this.state.erreur)}
        </pre>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={this.exporter} style={{ ...btn, background: "#5493FF", border: "none", color: "#fff" }}>
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
