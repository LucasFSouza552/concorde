import { WifiOff } from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";

import styles from "./BootScreen.module.css";

export default function OfflineScreen() {
    const { attempts, retryConnection } = useAuth();

    return (
        <div className={styles.screen} role="alert">
            <span className={styles.iconWrap} aria-hidden="true">
                <WifiOff size={28} />
            </span>
            <h1 className={styles.title}>Sem conexão com o servidor</h1>
            <p className={styles.hint}>
                Tentando reconectar automaticamente
                {attempts > 0 ? ` (tentativa ${attempts})` : ""}...
            </p>
            <button type="button" className={styles.retryBtn} onClick={() => void retryConnection()}>
                Tentar agora
            </button>
        </div>
    );
}
