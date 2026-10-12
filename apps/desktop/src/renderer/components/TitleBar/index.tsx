import { Minus, Square, X } from "lucide-react";

import styles from "./TitleBar.module.css";

export default function TitleBar({ title = "Concorde" }) {
    return (
        <div className={styles.titleBar}>
            <span className={styles.title}>{title}</span>
            <div className={styles.windowControls}>
                <button type="button" className={styles.windowBtn} aria-label="Minimizar" onClick={() => window.concorde.window.minimize()}>
                    <Minus size={12} />
                </button>
                <button type="button" className={styles.windowBtn} aria-label="Maximizar" onClick={() => window.concorde.window.maximize()}>
                    <Square size={12} />
                </button>
                <button type="button" className={`${styles.windowBtn} ${styles.windowBtnClose}`} aria-label="Fechar" onClick={() => window.concorde.window.close()}>
                    <X size={18} />
                </button>
            </div>
        </div>
    );
}