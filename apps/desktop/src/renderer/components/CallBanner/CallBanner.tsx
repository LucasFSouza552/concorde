import { PhoneIncoming, PhoneOff } from "lucide-react";

import { useCallInviteState } from "../../contexts/CallInviteProvider";

import styles from "./CallBanner.module.css";

function initialOf(name: string): string {
    return name.trim().charAt(0).toUpperCase() || "?";
}

export function CallBanner() {
    const { incoming, acceptIncoming, declineIncoming } = useCallInviteState();

    if (!incoming) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.card} role="alertdialog" aria-label="Chamada recebida">
                    <span className={styles.avatar}>{initialOf(incoming.fromDisplayName)}</span>
                    <div>
                        <p className={styles.name}>{incoming.fromDisplayName}</p>
                        <p className={styles.hint}>está te ligando...</p>
                    </div>
                    <div className={styles.actions}>
                        <button type="button" className={`${styles.callAction} ${styles.accept}`} onClick={() => void acceptIncoming()}>
                            <span className={styles.callActionIcon}><PhoneIncoming size={24} /></span>
                            Atender
                        </button>
                        <button type="button" className={`${styles.callAction} ${styles.decline}`} onClick={() => void declineIncoming()}>
                            <span className={styles.callActionIcon}><PhoneOff size={24} /></span>
                            Recusar
                        </button>
                    </div>
                </div>
            </div>
        );
}
