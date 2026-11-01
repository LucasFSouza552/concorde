import { useEffect } from "react";

import { useActiveCall } from "../../contexts/ActiveCallProvider";
import { useSettings } from "../../contexts/SettingsProvider";

import styles from "./PeerAudioMenu.module.css";

interface PeerAudioMenuProps {
    peerId: string;
    peerName: string;
    x: number;
    y: number;
    onClose: () => void;
}

export default function PeerAudioMenu({ peerId, peerName, x, y, onClose }: PeerAudioMenuProps) {
    const {
        peerVoiceVolumes, setPeerVoiceVolume,
        peerShareAudios, setPeerShareAudio,
    } = useSettings().audio;
    const { remoteScreenAudioStreams, peerRtt, peerSharing, watchingShareIds, watchShare, unwatchShare } = useActiveCall();

    const sharing = !!peerSharing[peerId];

    useEffect(() => {
        function handleMouseDown(event: MouseEvent) {
            const target = event.target as Element | null;
            if (target?.closest(`.${styles.menu}`)) return;
            onClose();
        }
        function handleKeyDown(event: globalThis.KeyboardEvent) {
            if (event.key === "Escape") onClose();
        }
        document.addEventListener("mousedown", handleMouseDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleMouseDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose]);

    const voiceVolume = peerVoiceVolumes[peerId] ?? 1;
    const share = peerShareAudios[peerId];
    const sharingAudio = !!remoteScreenAudioStreams[peerId];
    const rtt = peerRtt[peerId];
    const watching = watchingShareIds.has(peerId);

    return (
        <div
            className={styles.menu}
            style={{
                left: Math.max(8, Math.min(x, window.innerWidth - 268)),
                top: Math.max(8, Math.min(y, window.innerHeight - (sharing ? 290 : 210))),
            }}
            aria-label={`Usuário de ${peerName}`}
        >
            <p className={styles.title}>{peerName}</p>

            <div className={styles.row}>
                <span className={styles.label}>Latência</span>
                <span className={styles.value}>
                    {typeof rtt === "number" ? `${rtt} ms` : "Medindo..."}
                </span>
            </div>

            <div className={styles.row}>
                <label htmlFor="peer-audio-voice" className={styles.label}>Volume da voz</label>
                <span className={styles.value}>{Math.round(voiceVolume * 100)}%</span>
            </div>
            <input
                id="peer-audio-voice"
                type="range"
                className={styles.slider}
                min={0}
                max={2}
                step={0.05}
                value={voiceVolume}
                onChange={(event) => setPeerVoiceVolume(peerId, Number(event.target.value))}
            />

            {sharing && (
                <>
                    <p className={styles.section}>Transmissão</p>
                    <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => (watching ? unwatchShare(peerId) : watchShare(peerId))}
                    >
                        {watching ? "Parar de assistir" : "Assistir transmissão"}
                    </button>

                    {sharingAudio && (
                        <>
                            <label className={styles.check}>
                                <input
                                    type="checkbox"
                                    checked={!(share?.muted ?? false)}
                                    onChange={(event) => setPeerShareAudio(peerId, { muted: !event.target.checked })}
                                />
                                Receber áudio
                            </label>
                            <div className={styles.row}>
                                <label htmlFor="peer-audio-share" className={styles.label}>Volume da transmissão</label>
                                <span className={styles.value}>{Math.round((share?.volume ?? 1) * 100)}%</span>
                            </div>
                            <input
                                id="peer-audio-share"
                                type="range"
                                className={styles.slider}
                                min={0}
                                max={2}
                                step={0.05}
                                value={share?.volume ?? 1}
                                onChange={(event) => setPeerShareAudio(peerId, { volume: Number(event.target.value) })}
                            />
                        </>
                    )}
                </>
            )}
        </div>
    );
}
