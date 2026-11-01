import { useEffect, useState } from "react";
import type { KeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import { Eye, HeadphoneOff, MicOff } from "lucide-react";

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

    isSharing?: boolean;
    onWatchShare?: () => void;
    rtt?: number | null;

    /** Quem assiste à minha transmissão (nomes) — só no tile local. */
    viewers?: string[];
}

export default function ParticipantTile({ name, muted, deafened = false, isLocal = false, speaking = false, ringing = false, screenStream, focused = false, onToggleFocus, onContextMenu, isSharing = false, onWatchShare, rtt, viewers = [] }: ParticipantTileProps) {
    const initial = name.trim().charAt(0).toUpperCase() || "?";
    const clickable = onToggleFocus !== undefined;
    const [windowActive, setWindowActive] = useState(true);

    useEffect(() => {
        const update = () => setWindowActive(document.visibilityState === "visible" && document.hasFocus());
        update();
        document.addEventListener("visibilitychange", update);
        window.addEventListener("focus", update);
        window.addEventListener("blur", update);
        return () => {
            document.removeEventListener("visibilitychange", update);
            window.removeEventListener("focus", update);
            window.removeEventListener("blur", update);
        };
    }, []);

    const showLocalPreview = !isLocal || windowActive;

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
            {isLocal && viewers.length > 0 && (
                <div className={styles.viewersBadge} title={viewers.join(", ")}>
                    <Eye size={14} />
                    <span>{viewers.length}</span>
                    <span className={styles.viewerStack}>
                        {viewers.slice(0, 3).map((viewer, index) => (
                            <span key={`${viewer}-${index}`} className={styles.viewerAvatar}>
                                {viewer.trim().charAt(0).toUpperCase() || "?"}
                            </span>
                        ))}
                        {viewers.length > 3 && (
                            <span className={styles.viewerAvatar} title={viewers.slice(3).join(", ")}>
                                +{viewers.length - 3}
                            </span>
                        )}
                    </span>
                </div>
            )}
            {isLocal && screenStream && showLocalPreview ? (
                <ScreenVideo stream={screenStream} />
            ) : isLocal && screenStream ? (
                <div
                    className={styles.media}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text)", textAlign: "center", padding: "1rem" }}
                >
                    Você está compartilhando a tela
                </div>
            ) : screenStream ? (
                <ScreenVideo stream={screenStream} />
            ) : isSharing && onWatchShare ? (
                <div className={styles.media} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                    <div className={styles.avatar}>
                        {initial}
                    </div>
                    <button
                        type="button"
                        className={styles.watchBtn}
                        onClick={(event) => {
                            event.stopPropagation();
                            onWatchShare();
                        }}
                    >
                        Assistir compartilhamento
                    </button>
                </div>
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
                        {typeof rtt === "number" && (
                            <span
                                className={`${styles.rttBadge} ${rtt <= 100 ? styles.rttGood : rtt <= 250 ? styles.rttOk : styles.rttBad}`}
                                title="Latência até este participante"
                            >
                                {rtt} ms
                            </span>
                        )}
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