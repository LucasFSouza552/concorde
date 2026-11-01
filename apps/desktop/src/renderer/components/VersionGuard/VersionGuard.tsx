import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpCircle, RefreshCw } from "lucide-react";

import { useAppUpdate } from "../../hooks/useAppUpdate";
import { fetchVersionPolicy, isOutdatedVersion, type VersionPolicy } from "../../utils/versionPolicy";

import styles from "./VersionGuard.module.css";

const RECHECK_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Bloqueia o app quando o servidor marca uma versão mínima obrigatória
 * e o cliente está atrás. Complementa o fluxo do auto-updater:
 * enquanto o bloqueio vale, o download roda em segundo plano e o
 * usuário conclui com "Instalar agora".
 */
export default function VersionGuard() {
    const { status, quitAndInstall } = useAppUpdate();
    const [policy, setPolicy] = useState<VersionPolicy | null>(null);
    const [current, setCurrent] = useState<string | null>(null);
    const policyRef = useRef<VersionPolicy | null>(null);
    const currentRef = useRef<string | null>(null);
    const busyRef = useRef(false);

    const recheck = useCallback(async () => {
        if (busyRef.current) return;
        busyRef.current = true;

        try {
            const appVersion = await window.concorde?.app?.getVersion() ?? null;
            const nextPolicy = await fetchVersionPolicy();

            policyRef.current = nextPolicy;
            currentRef.current = appVersion;
            setPolicy(nextPolicy);
            setCurrent(appVersion);
        } finally {
            busyRef.current = false;
        }
    }, []);

    useEffect(() => {
        void recheck();
        const timer = setInterval(() => { void recheck(); }, RECHECK_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [recheck]);

    const minimum = policy?.minimum ?? null;
    const blocked = policy && current && isOutdatedVersion(current, minimum);

    if (!blocked) return null;

    // Estado do download em segundo plano: pronto → "Instalar agora".
    const ready = status?.state === "ready";
    const downloading = status?.state === "downloading";
    const percent = status?.percent ?? 0;
    const expected = status?.version ?? policy?.latest ?? minimum ?? "";

    return (
        <div className={styles.overlay}>
            <div className={styles.card}>
                <span className={styles.icon} aria-hidden="true">
                    <ArrowUpCircle size={38} />
                </span>
                <h1 className={styles.title}>Atualização obrigatória</h1>
                <p className={styles.desc}>
                    Sua versão <b>{current}</b> está desatualizada
                    (mínima exigida: <b>{minimum}</b>). Continue no app para terminar a
                    atualização.
                </p>
                {downloading && (
                    <>
                        <p className={styles.caption}>
                            <RefreshCw size={11} /> Baixando {expected}... {percent.toFixed(0)}%
                        </p>
                        <div className={styles.progress} aria-hidden="true">
                            <div className={styles.progressFill} style={{ width: `${percent}%` }} />
                        </div>
                    </>
                )}
                <button
                    type="button"
                    className={styles.installBtn}
                    disabled={!ready}
                    onClick={quitAndInstall}
                >
                    {ready ? "Instalar agora" : downloading ? "Baixando..." : "Verificando atualização..."}
                </button>
                <p className={styles.caption}>Não feche o aplicativo durante o download.</p>
            </div>
        </div>
    );
}
