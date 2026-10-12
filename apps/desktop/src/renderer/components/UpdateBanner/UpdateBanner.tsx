import { useAppUpdate } from "../../hooks/useAppUpdate";

import styles from "./UpdateBanner.module.css";

export default function UpdateBanner() {
    const { status, quitAndInstall } = useAppUpdate();

    if (status.state === "idle") return null;

    return (
        <div className={styles.banner} role="status">
            {status.state === "ready" ? (
                <>
                    <span className={styles.text}>
                        Atualização {status.version ? `${status.version} ` : ""}baixada
                    </span>
                    <button type="button" className={styles.action} onClick={quitAndInstall}>
                        Reiniciar para atualizar
                    </button>
                </>
            ) : (
                <span className={styles.text}>
                    {status.state === "downloading" && status.percent !== undefined
                        ? `Baixando atualização... ${Math.round(status.percent)}%`
                        : "Nova atualização encontrada..."}
                </span>
            )}
        </div>
    );
}
