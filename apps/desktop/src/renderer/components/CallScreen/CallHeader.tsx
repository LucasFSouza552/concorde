import { ChevronLeft } from "lucide-react";

import styles from "./CallScreen.module.css";

interface CallHeaderProps {
    peerName?: string;
    onBack?: () => void;
}

export default function CallHeader({ peerName, onBack }: CallHeaderProps) {
    if (!peerName && !onBack) return null;

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
            {peerName && <span className={styles.peerName}>{peerName}</span>}
        </div>
    );
}
