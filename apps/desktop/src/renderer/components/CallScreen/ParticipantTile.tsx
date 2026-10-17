import type { KeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import { HeadphoneOff, MicOff } from "lucide-react";

import { ScreenVideo } from "./ScreenVideo";

import styles from "./CallScreen.module.css";

interface ParticipantTileProps {
    name: string;
    muted: boolean;
    deafened?: boolean;
    isLocal?: boolean;
    speaking?: boolean;
    ringing?: boolean;
    screenStream?: MediaStream | null;
    focused?: boolean;
    onToggleFocus?: () => void;
    onContextMenu?: (event: ReactMouseEvent<HTMLDivElement>) => void;
}

export default function ParticipantTile({ name, muted, deafened = false, isLocal = false, speaking = false, ringing = false, screenStream, focused = false, onToggleFocus, onContextMenu }: ParticipantTileProps) {
    const initial = name.trim().charAt(0).toUpperCase() || "?";
    const clickable = onToggleFocus !== undefined;

    return (
        <div
            className={`${styles.tile} ${speaking ? styles.speaking : ""} ${clickable ? styles.tileClickable : ""}`}
            onContextMenu={onContextMenu}
            {...(clickable ? {
                role: "button",
                tabIndex: 0,
                title: focused ? "Clique para voltar à grade" : `Clique para focar em ${name}`,
                onClick: onToggleFocus,
                onKeyDown: (event: KeyboardEvent) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onToggleFocus();
                    }
                },
            } : {})}
        >
            {screenStream ? (
                <ScreenVideo stream={screenStream} />
            ) : (<>
                <div className={styles.media}>
                    <div className={`${styles.avatar} ${muted ? styles.avatarMuted : ""} ${ringing ? styles.ringing : ""}`}>
                        {initial}
                    </div>
                </div>

                <div className={styles.footer}>
                    <div className={styles.nameSection}>
                        <span className={styles.name}>
                            {name}
                        </span>
                        {isLocal && <span className={styles.youLabel}>(Você)</span>}
                        {ringing && <span className={styles.ringingLabel}>chamando...</span>}
                    </div>
                </div>

                {muted && (
                    <span
                        className={styles.mutedBadge}
                        title={deafened ? "Áudio desativado" : "Mutado"}
                    >
                        {deafened
                            ? <HeadphoneOff size={14} />
                            : <MicOff size={14} />}
                    </span>
                )}
            </>)}
        </div>
    );
}