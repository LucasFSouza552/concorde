import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { Maximize, Minimize } from "lucide-react";

import CallControls from "./CallControls";
import CallGrid, { type GridTile } from "./CallGrid";
import CallHeader from "./CallHeader";
import FocusStage from "./FocusStage";
import ParticipantTile from "./ParticipantTile";
import PeerAudioMenu from "./PeerAudioMenu";
import { useActiveCall } from "../../contexts/ActiveCallProvider";
import { useAuth } from "../../contexts/AuthContext";
import { useCallInviteState } from "../../contexts/CallInviteProvider";

import { useFullscreen } from "../../hooks/useFullscreen";

import styles from "./CallScreen.module.css";

interface CallScreenProps {
    layout?: "panel" | "full";
    controls?: boolean;
    chatAvailable?: boolean;
    chatOpen?: boolean;
    onToggleChat?: () => void;
    peerName?: string;
    onBack?: () => void;
    flat?: boolean;
    preview?: {
        peers: { userId: string; username: string }[];
        action: ReactNode;
    } | null;
}

const LOCAL_ID = "local";

export default function CallScreen({ layout = "panel", controls = true, chatAvailable = false, chatOpen = false, onToggleChat, peerName, onBack, preview = null, flat = false }: CallScreenProps) {
    const { groupId, peers, peerMuted, peerSharing, micMuted, deafened, status, remoteScreenStreams, screenStream, speakingMap } = useActiveCall();
    const { outgoing } = useCallInviteState();
    const { user } = useAuth();
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const [audioMenu, setAudioMenu] = useState<{ peerId: string; peerName: string; x: number; y: number } | null>(null);
    const dismissedSharer = useRef<string | null>(null);
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

    const ringingNames: string[] = !preview && outgoing.status === "dialing-group"
        ? outgoing.pending
            .filter((item) => !peers.some((peer) => peer.userId === item.userId))
            .map((item) => item.displayName)
        : [];

    function openAudioMenu(event: ReactMouseEvent<HTMLDivElement>, peerId: string, peerName: string) {
        event.preventDefault();
        event.stopPropagation();
        setAudioMenu({ peerId, peerName, x: event.clientX, y: event.clientY });
    }

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
                        onContextMenu={(event) => openAudioMenu(event, peer.userId, peer.username)}
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
            className={`${layout === "full" ? styles.full : styles.panel} ${flat ? styles.flat : ""}`}
            aria-label="Chamada ativa"
        >
            <CallHeader
                peerName={peerName}
                statusText={preview ? "Chamada ativa" : "Em chamada"}
                onBack={onBack}
            />
            {preview ? (
                <CallGrid tiles={tiles} />
            ) : status !== "connected" ? (
                <span>Conectando...</span>
            ) : focusedTile ? (
                <FocusStage tileId={focusedTile.id} node={focusedTile.node} />
            ) : (
                <CallGrid
                    tiles={tiles}
                    ringingNames={ringing && outgoing.status === "dialing" ? [outgoing.toDisplayName] : ringingNames}
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
            {audioMenu && (
                <PeerAudioMenu
                    peerId={audioMenu.peerId}
                    peerName={audioMenu.peerName}
                    x={audioMenu.x}
                    y={audioMenu.y}
                    onClose={() => setAudioMenu(null)}
                />
            )}
        </section>
    );
}
