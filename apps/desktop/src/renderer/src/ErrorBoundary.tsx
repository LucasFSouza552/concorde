import React from "react";

import styles from "./ErrorBoundary.module.css";

interface ErrorBoundaryState {
    errored: boolean;
}

/**
 * Rede de segurança do renderer: se qualquer erro interno derrubar o app,
 * o usuário vê uma tela de recuperação em vez de uma janela branca/congelada.
 */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
    state: ErrorBoundaryState = { errored: false };

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { errored: true };
    }

    componentDidCatch(error: unknown) {
        console.error("[crash] erro no renderer:", error);
    }

    render() {
        if (!this.state.errored) {
            return this.props.children;
        }

        return (
            <div className={styles.overlay}>
                <div className={styles.card}>
                    <h1 className={styles.title}>Ops, algo deu errado...</h1>
                    <p className={styles.desc}>
                        O aplicativo travou por um erro interno. Recarregue para continuar.
                    </p>
                    <button
                        type="button"
                        className={styles.reloadBtn}
                        onClick={() => window.location.reload()}
                    >
                        Recarregar app
                    </button>
                </div>
            </div>
        );
    }
}
