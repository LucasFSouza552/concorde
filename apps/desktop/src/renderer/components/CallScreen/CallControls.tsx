import { useState } from "react";
import { HeadphoneOff, Headphones, MessageSquareOff, MessageSquareText, Mic, MicOff, Monitor, MonitorOff, PhoneOff } from "lucide-react";

import SourceModal from "./SourceModal";
import { useActiveCall } from "../../contexts/ActiveCallProvider";
import { useCallInviteState } from "../../contexts/CallInviteProvider";

import { getErrorMessage } from "../../api/api";

import styles from "./CallScreen.module.css";

interface CallControlsProps {
    chatAvailable?: boolean;
    chatOpen?: boolean;
    onToggleChat?: () => void;
}

export default function CallControls({ chatAvailable = false, chatOpen = false, onToggleChat }: CallControlsProps) {
    const { micMuted, deafened, toggleMic, toggleDeafen, startScreenShare, stopScreenShare, screenStream } = useActiveCall();
    const { hangUp } = useCallInviteState();
    const [shareError, setShareError] = useState<string | null>(null)
    const [showSource, setShowSource] = useState(false);
    const effectiveMicMuted = micMuted || deafened;

    async function handleShare() {
        try {
            setShareError(null);

            if (screenStream) {
                stopScreenShare();
                return;
            }

            setShowSource((showSource) => !showSource);
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") return;
            setShareError(getErrorMessage(error));
        }
    }

    return (
        <div className={styles.controls}>
            {chatAvailable && onToggleChat && (
                <span className={styles.chatCorner}>
                    <button
                        type="button"
                        className={`${styles.controlBtn} ${chatOpen ? styles.toggleOn : ""}`}
                        aria-label={chatOpen ? "Ocultar chat" : "Mostrar chat"}
                        aria-pressed={chatOpen}
                        title={chatOpen ? "Ocultar chat" : "Mostrar chat"}
                        onClick={onToggleChat}
                    >
                        {chatOpen ? <MessageSquareText size={18} /> : <MessageSquareOff size={18} />}
                    </button>
                </span>
            )}
            <button
                type="button"
                className={styles.controlBtn}
                aria-label={effectiveMicMuted ? "Desmutar microfone" : "Silenciar microfone"}
                aria-pressed={effectiveMicMuted}
                onClick={toggleMic}
            >
                {effectiveMicMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
                type="button"
                className={styles.controlBtn}
                aria-label={deafened ? "Ativar áudio" : "Desativar áudio"}
                aria-pressed={deafened}
                onClick={toggleDeafen}
            >
                {deafened ? <HeadphoneOff size={18} /> : <Headphones size={18} />}
            </button>
            <button
                type="button"
                className={styles.controlBtn}
                aria-label={screenStream ? "Parar de compartilhar" : "Compartilhar tela"}
                aria-pressed={!!screenStream}
                onClick={() => void handleShare()}
            >
                {screenStream ? <MonitorOff size={18} /> : <Monitor size={18} />}
            </button>
            <button
                type="button"
                aria-label="Sair da chamada"
                className={`${styles.controlBtn} ${styles.leave}`}
                onClick={() => void hangUp()}
            >
                <PhoneOff size={18} />
            </button>

            {showSource && (
                <SourceModal
                    onClose={() => setShowSource(false)}
                    onStart={(sourceId, quality, includeAudio) => {
                        console.log("INICIAR COMPARTILHAMENTO DE TELA")
                        void startScreenShare(sourceId, quality, includeAudio);
                    }}
                />
            )}
            {shareError && <div>
                <p>{shareError}</p>
            </div>}
        </div>
    );
}