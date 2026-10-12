import { HeadphoneOff, MicOff } from "lucide-react";

import styles from "./VoiceList.module.css";

interface VoiceRowProps {
    name: string;
    muted: boolean;
    deafened?: boolean;
    isLocal?: boolean;
}

export default function VoiceRow({ name, muted, deafened = false, isLocal = false }: VoiceRowProps) {
    const initial = name.trim().charAt(0).toUpperCase() || "?";

    return (
        <div className={styles.row}>
            <span className={styles.avatar}>{initial}</span>
            <span className={styles.name}>
                {name}{isLocal ? " (você)" : ""}
            </span>
            {muted && (
                <span className={styles.on} title="Sem áudio">
                    <MicOff size={14} />
                </span>
            )}
            {deafened && (
                <span className={styles.on} title="Áudio desativado">
                    <HeadphoneOff size={14} />
                </span>
            )}
        </div>
    );
}
