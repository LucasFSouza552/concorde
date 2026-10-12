import { useAuth } from "../../contexts/AuthContext";

import styles from "./BootScreen.module.css";

export default function BootScreen() {
    const { bootStep } = useAuth();

    return (
        <div className={styles.screen} role="status" aria-live="polite">
            <h1 className={styles.brand}>Concorde</h1>
            <span className={styles.spinner} aria-hidden="true" />
            <p className={styles.step}>{bootStep}</p>
        </div>
    );
}
