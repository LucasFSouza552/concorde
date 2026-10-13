import { useEffect, useState } from "react";
import { Minus, Square, X } from "lucide-react";

import { API_BASE_URL } from "../../api/api";

import styles from "./TitleBar.module.css";

const isLocalBackend = API_BASE_URL.includes("localhost");

export default function TitleBar({ title = "Concorde" }) {
    const [version, setVersion] = useState<string | null>(null);

    useEffect(() => {
        window.concorde?.app?.getVersion()
            .then((current) => setVersion(current))
            .catch(() => { });
    }, []);

    return (
        <div className={styles.titleBar}>
            <span className={styles.title}>
                {title}
                {version && (isLocalBackend
                    ? <span className={styles.envTag}> v{version}-DEV</span>
                    : <span className={styles.versionTag}> v{version}</span>)}
            </span>
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