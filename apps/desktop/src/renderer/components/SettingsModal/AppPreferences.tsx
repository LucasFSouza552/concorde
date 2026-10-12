import styles from "./SettingsModal.module.css";

export default function AppPreferences() {
    return (
        <section className={styles.panel}>
            <h3 className={styles.panelTitle}>Preferências</h3>
            <p className={styles.panelDesc}>Ajustes gerais do aplicativo.</p>
            <p className={styles.emptyState}>Nenhuma preferência por enquanto.</p>
        </section>
    );
}