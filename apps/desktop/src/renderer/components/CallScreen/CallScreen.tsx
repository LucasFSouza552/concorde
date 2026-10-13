import { useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize, Minimize } from "lucide-react";

import CallControls from "./CallControls";
import CallGrid, { type GridTile } from "./CallGrid";
import CallHeader from "./CallHeader";
import FocusStage from "./FocusStage";
import ParticipantTile from "./ParticipantTile";
import { useActiveCall } from "../../contexts/ActiveCallProvider";
import { useAuth } from "../../contexts/AuthContext";
import { useCallInviteState } from "../../contexts/CallInviteProvider";

import { useFullscreen } from "../../hooks/useFullscreen";
import { useSpeakingIndicators } from "../../hooks/useSpeakingIndicators";

import styles from "./CallScreen.module.css";

interface CallScreenProps {
    layout?: "panel" | "full";
    controls?: boolean;
    chatAvailable?: boolean;
    chatOpen?: boolean;
    onToggleChat?: () => void;
    peerName?: string;
    onBack?: () => void;
    preview?: {
        peers: { userId: string; username: string }[];
        action: ReactNode;
    } | null;
}

const LOCAL_ID = "local";

export default function CallScreen({ layout = "panel", controls = true, chatAvailable = false, chatOpen = false, onToggleChat, peerName, onBack, preview = null }: CallScreenProps) {
    const { groupId, peers, peerMuted, peerSharing, micMuted, deafened, status, remoteScreenStreams, screenStream, localStream, remoteStreams } = useActiveCall();
    const { outgoing } = useCallInviteState();
    const { user } = useAuth();
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const dismissedSharer = useRef<string | null>(null);
    const speakingMap = useSpeakingIndicators(localStream, remoteStreams);
    const { ref: sectionRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen<HTMLElement>();

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

    if (!groupId && !preview) return null;

    const ringing = !preview && outgoing.status === "dialing" && peers.length === 0;

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

    const tiles: GridTile[] = preview
        ? preview.peers.map((peer) => ({
            id: peer.userId,
            node: (
                <ParticipantTile
                    key={peer.userId}
                    name={peer.username}
                    muted={false}
                    speaking
                />
            ),
        }))
        : [
            {
                id: LOCAL_ID,
                node: (
                    <ParticipantTile
                        name={user?.displayName ?? "Você"}
                        muted={micMuted || deafened}
                        deafened={deafened}
                        isLocal
                        speaking={!!speakingMap[LOCAL_ID]}
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
                        speaking={!!speakingMap[peer.userId]}
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
            ref={sectionRef}
            className={layout === "full" ? styles.full : styles.panel}
            aria-label="Chamada ativa"
        >
            <CallHeader peerName={peerName} onBack={onBack} />
            {preview ? (
                <CallGrid tiles={tiles} />
            ) : status !== "connected" ? (
                <span>Conectando...</span>
            ) : focusedTile ? (
                <FocusStage tileId={focusedTile.id} node={focusedTile.node} />
            ) : (
                <CallGrid
                    tiles={tiles}
                    ringingName={ringing && outgoing.status === "dialing" ? outgoing.toDisplayName : undefined}
                />
            )}

            {preview ? (
                <div className={styles.previewControls}>
                    {preview.action}
                </div>
            ) : controls && (
                <>
                    <CallControls
                        chatAvailable={chatAvailable}
                        chatOpen={chatOpen}
                        onToggleChat={onToggleChat}
                    />
                    <button
                        type="button"
                        className={styles.fullscreenBtn}
                        aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                        title={isFullscreen ? "Sair da tela cheia (Esc)" : "Tela cheia"}
                        onClick={toggleFullscreen}
                    >
                        {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                    </button>
                </>
            )}
        </section>
    );
}
