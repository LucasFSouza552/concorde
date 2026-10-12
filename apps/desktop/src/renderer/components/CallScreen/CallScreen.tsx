import { useEffect, useRef, useState, type ReactNode } from "react";
import { LayoutGrid, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import CallControls from "./CallControls";
import ParticipantTile from "./ParticipantTile";
import { useActiveCall } from "../../contexts/ActiveCallProvider";
import { useAuth } from "../../contexts/AuthContext";
import { useCallInviteState } from "../../contexts/CallInviteProvider";

import styles from "./CallScreen.module.css";

interface CallScreenProps {
    layout?: "panel" | "full";
    controls?: boolean;
    chatAvailable?: boolean;
    chatOpen?: boolean;
    onToggleChat?: () => void;
    sidebarOpen?: boolean;
    onToggleSidebar?: () => void;
}

const LOCAL_ID = "local";

export default function CallScreen({ layout = "panel", controls = true, chatAvailable = false, chatOpen = false, onToggleChat, sidebarOpen = true, onToggleSidebar }: CallScreenProps) {
    const { groupId, peers, peerMuted, peerSharing, micMuted, deafened, status, remoteScreenStreams, screenStream } = useActiveCall();
    const { outgoing } = useCallInviteState();
    const { user } = useAuth();
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const dismissedSharer = useRef<string | null>(null);

    const sharerId = screenStream
        ? LOCAL_ID
        : (peers.find((peer) => peerSharing[peer.userId])?.userId ?? null);

    useEffect(() => {
        if (sharerId && sharerId !== dismissedSharer.current) {
            setFocusedId((current) => current ?? sharerId);
        }
        if (!sharerId) {
            dismissedSharer.current = null;
        }
    }, [sharerId]);

    useEffect(() => {
        function handleKeyDown(event: globalThis.KeyboardEvent) {
            if (event.key === "Escape") {
                setFocusedId(null);
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    if (!groupId) return null;

    const ringing = outgoing.status === "dialing" && peers.length === 0;

    function toggleFocus(id: string) {
        setFocusedId((current) => {
            if (current === id) {
                if (sharerId === id) {
                    dismissedSharer.current = id;
                }
                return null;
            }
            return id;
        });
    }

    const tiles: { id: string; node: ReactNode }[] = [
        {
            id: LOCAL_ID,
            node: (
                <ParticipantTile
                    name={user?.displayName ?? "Você"}
                    muted={micMuted || deafened}
                    deafened={deafened}
                    isLocal
                    screenStream={screenStream}
                    focused={focusedId === LOCAL_ID}
                    onToggleFocus={() => toggleFocus(LOCAL_ID)}
                />
            ),
        },
        ...peers.map((peer) => ({
            id: peer.userId,
            node: (
                <ParticipantTile
                    key={peer.userId}
                    name={peer.username}
                    muted={peerMuted[peer.userId]?.muted ?? false}
                    deafened={peerMuted[peer.userId]?.deafened ?? false}
                    screenStream={peerSharing[peer.userId] ? (remoteScreenStreams[peer.userId] ?? null) : null}
                    focused={focusedId === peer.userId}
                    onToggleFocus={() => toggleFocus(peer.userId)}
                />
            ),
        })),
    ];

    const focusedTile = focusedId ? tiles.find((tile) => tile.id === focusedId) : undefined;

    return (
        <section
            className={layout === "full" ? styles.full : styles.panel}
            aria-label="Chamada ativa"
        >
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    {onToggleSidebar && (
                        <button
                            type="button"
                            className={styles.cornerBtn}
                            aria-label={sidebarOpen ? "Ocultar barra lateral" : "Mostrar barra lateral"}
                            title={sidebarOpen ? "Ocultar barra lateral" : "Mostrar barra lateral"}
                            onClick={onToggleSidebar}
                        >
                            {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
                        </button>
                    )}
                    <h3 className={styles.headerTitle}>Em chamada</h3>
                </div>
                <span className={styles.headerMeta}>{peers.length + 1} na sala</span>
            </header>

            {status !== "connected" ? (
                <span>Conectando...</span>
            ) : focusedTile ? (
                <div className={styles.spotlight}>
                    <div className={styles.focusStage} key={focusedTile.id}>
                        {focusedTile.node}
                        <button
                            type="button"
                            className={styles.unfocusBtn}
                            title="Voltar à grade (Esc)"
                            aria-label="Voltar à grade"
                            onClick={() => toggleFocus(focusedTile.id)}
                        >
                            <LayoutGrid size={14} />
                            Grade
                        </button>
                    </div>
                </div>
            ) : (
                <div className={styles.grid}>
                    {tiles.map((tile) => (
                        <div className={styles.gridItem} key={tile.id}>
                            {tile.node}
                        </div>
                    ))}
                    {ringing && (
                        <div className={styles.gridItem}>
                            <ParticipantTile
                                name={outgoing.status === "dialing" ? outgoing.toDisplayName : ""}
                                muted={false}
                                ringing
                            />
                        </div>
                    )}
                </div>
            )}

            {controls && (
                <CallControls
                    chatAvailable={chatAvailable}
                    chatOpen={chatOpen}
                    onToggleChat={onToggleChat}
                />
            )}
        </section>
    );
}