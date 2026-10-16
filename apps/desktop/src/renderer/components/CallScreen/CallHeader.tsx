import { ChevronLeft } from "lucide-react";

import styles from "./CallScreen.module.css";

interface CallHeaderProps {
    peerName?: string;
    statusText?: string;
    onBack?: () => void;
}

export default function CallHeader({ peerName, statusText, onBack }: CallHeaderProps) {
    if (!peerName && !onBack) return null;

    const initial = (peerName ?? "?").trim().charAt(0).toUpperCase() || "?";

    return (
        <div className={styles.peerRow}>
            {onBack && (
                <button
                    type="button"
                    className={styles.cornerBtn}
                    aria-label="Voltar para amigos"
                    title="Voltar para amigos"
                    onClick={onBack}
                >
                    <ChevronLeft size={16} />
                </button>
            )}
            {peerName && (
                <span className={styles.peerAvatar} aria-hidden="true">
                    {initial}
                </span>
            )}
            <div className={styles.peerText}>
                {peerName && <span className={styles.peerName}>{peerName}</span>}
                {statusText && <span className={styles.peerStatus}>{statusText}</span>}
            </div>
        </div>
    );
}
