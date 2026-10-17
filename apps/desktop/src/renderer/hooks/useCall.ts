import { useEffect, useRef, useState } from "react";

import type { ClientMessage, ForwardedDirectMessage, Peer, ScreenQuality } from "@concorde/shared";
import { createCallSocket, type CallSocket, type CallStatus } from "./CallSocket";
import { startWindowAudio, stopWindowAudio } from "./screenProcessAudio";
import { useLocalMedia } from "./useLocalMedia";
import { createWebRTCManager } from "./WebRTCManager";
import { playSound } from "../audio/sounds";
import { useToast } from "../contexts/ToastProvider";

import { WS_BASE_URL } from "../api/api";
import { getSession } from "../api/session";

interface UseCallResult {
    status: CallStatus;
    peers: Peer[];
    send: (message: ClientMessage) => void;

    localStream: MediaStream | null;
    remoteStreams: Record<string, MediaStream>;
    peerMuted: Record<string, { muted: boolean; deafened: boolean }>;
    peerSharing: Record<string, boolean>;
    switchMicrophone: (next: MediaStream) => void;

    remoteScreenStreams: Record<string, MediaStream>;
    remoteScreenAudioStreams: Record<string, MediaStream>;

    screenStream: MediaStream | null;
    startScreenShare: (sourceId?: string, quality?: ScreenQuality, includeAudio?: boolean) => Promise<void>;
    stopScreenShare: () => void;

}

export function useCall(groupId: string | null): UseCallResult {
    const socketRef = useRef<CallSocket | null>(null);
    const [status, setStatus] = useState<CallStatus>("idle");
    const [peers, setPeers] = useState<Peer[]>([]);
    const [peerMuted, setPeerMuted] = useState<Record<string, { muted: boolean; deafened: boolean }>>({});
    const [peerSharing, setPeerSharing] = useState<Record<string, boolean>>({});

    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});

    const managerRef = useRef<ReturnType<typeof createWebRTCManager> | null>(null);
    const localMedia = useLocalMedia(groupId !== null);
    const { push: pushToast } = useToast();

    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const startingShareRef = useRef(false);
    const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({});
    const [remoteScreenAudioStreams, setRemoteScreenAudioStreams] = useState<Record<string, MediaStream>>({});

    if (!managerRef.current) {
        const session = getSession();

        managerRef.current = createWebRTCManager({
            emit: send,
            onRemoteStream: (peerId, stream) =>
                setRemoteStreams((current) => ({ ...current, [peerId]: stream })),
            getLocalStream: () => localMedia.getStream(),
            onRemoteScreenStream: (peerId, stream) =>
                setRemoteScreenStreams((current) => ({ ...current, [peerId]: stream })),
            onRemoteScreenAudio: (peerId, stream) =>
                setRemoteScreenAudioStreams((current) => ({ ...current, [peerId]: stream })),
            getScreenStream: () => screenStreamRef.current,
            shouldOffer: (peerId) => (session?.user.id ?? "") < peerId,
        });

    }

    const webrtc = managerRef.current;


    useEffect(() => {

        const session = getSession();
        if (!groupId || !session) return;

        const offerTo = (peerId: string) => {
            if (session.user.id < peerId) {
                webrtc.startOffer(peerId);
            }
        }

        socketRef.current = createCallSocket(`${WS_BASE_URL}/call/${groupId}`, {
            userId: session.user.id,
            username: session.user.displayName,

            onStatus: setStatus,

            onPeers: (incoming) => {
                setPeers(incoming);
                incoming.forEach((peer) => offerTo(peer.userId));
            },

            onPeerJoined: (peer) => {
                setPeers((current) => current.some((item) => item.userId === peer.userId)
                    ? current
                    : [...current, peer]
                );

                offerTo(peer.userId);
                playSound("join");
            },
            onPeerLeft: function (peerId: string): void {
                setPeers((current) =>
                    current.filter((peer) => peer.userId !== peerId)
                );

                webrtc.removePeer(peerId);

                setRemoteStreams((current) => {
                    const next = { ...current };
                    delete next[peerId];
                    return next;
                });

                setPeerMuted((current) => {
                    const next = { ...current };
                    delete next[peerId];
                    return next;
                });

                setPeerSharing((current) => {
                    const next = { ...current };
                    delete next[peerId];
                    return next;
                });

                setRemoteScreenStreams((current) => {
                    const next = { ...current };
                    delete next[peerId];
                    return next;
                });

                setRemoteScreenAudioStreams((current) => {
                    const next = { ...current };
                    delete next[peerId];
                    return next;
                });

                playSound("leave");
            },
            onDirect: function (message: ForwardedDirectMessage): void {
                const from = message.from;

                if (!from) return;

                switch (message.type) {
                    case "offer":
                        webrtc.handleOffer(from, message.sdp);
                        break;
                    case "answer":
                        webrtc.handleAnswer(from, message.sdp);
                        break;
                    case "ice-candidate":
                        webrtc.handleCandidate(from, message.candidate);
                        break;
                    case "mute-state":
                        setPeerMuted((current) => ({
                            ...current,
                            [message.from]: { muted: message.muted, deafened: message.deafened }
                        }));
                        break;
                    case "screen-share":
                        setPeerSharing((current) => ({
                            ...current,
                            [message.from]: message.sharing
                        }));
                        if (!message.sharing) {
                            setRemoteScreenAudioStreams((current) => {
                                const next = { ...current };
                                delete next[message.from];
                                return next;
                            });
                        }
                        break;
                }
            }
        });

        return () => {
            stopScreenShare();
            socketRef.current?.close();
            socketRef.current = null;

            webrtc.closeAll();
        };
    }, [groupId]);

    function send(message: ClientMessage) {
        socketRef.current?.send(message);
    }

    function switchMicrophone(next: MediaStream) {
        const track = localMedia.switchMicrophone(next);

        if (track) {
            webrtc.replaceAudioTrack(track);
        }
    }

    async function startScreenShare(sourceId?: string, quality?: ScreenQuality, includeAudio?: boolean, isWindow?: boolean) {
        if (startingShareRef.current) return;
        startingShareRef.current = true;

        try {
            if (screenStreamRef.current) {
                stopScreenShare();
            }
            await doStartScreenShare(sourceId, quality, includeAudio, isWindow);
        } finally {
            startingShareRef.current = false;
        }
    }

    async function doStartScreenShare(sourceId?: string, quality?: ScreenQuality, includeAudio?: boolean, isWindow?: boolean) {

        if (!sourceId) {
            throw new Error("Selecione uma janela para compartilhar tela");
        }

        const windowSource = !!isWindow && sourceId.startsWith("window:");
        const wantAudio = !!includeAudio && windowSource;

        if (includeAudio && !windowSource) {
            console.warn("Áudio disponível apenas para janelas.");
            pushToast("O audio da tela cheia nao e suportado. Compartilhando sem audio.", "info");
        }

        async function captureScreen(withAudio: boolean) {
            return navigator.mediaDevices.getUserMedia({
                audio: withAudio
                    ? { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: sourceId } } as unknown as MediaTrackConstraints
                    : false,
                video: {
                    mandatory: {
                        chromeMediaSource: "desktop",
                        chromeMediaSourceId: sourceId,
                        ...(quality ? {
                            maxWidth: quality.width,
                            maxHeight: quality.height,
                            maxFrameRate: quality.frameRate
                        } : {})
                    }
                } as unknown as MediaTrackConstraints
            });
        }

        let stream: MediaStream;
        let audioTrack: MediaStreamTrack | null = null;

        // Video da fonte selecionada. NUNCA capturamos audio global do sistema.
        stream = await captureScreen(false);

        // Audio SOMENTE da janela selecionada, capturado por processo (WASAPI
        // Process Loopback). Se falhar, compartilhamos sem audio — sem fallback.
        if (wantAudio) {
            try {
                const pid = await window.concorde?.windows.getPid(sourceId);
                if (pid) {
                    audioTrack = await startWindowAudio(pid);
                } else {
                    console.warn("[ScreenShare] nao foi possivel determinar o processo da janela; sem audio.");
                    pushToast("Nao foi possivel identificar o audio desta janela. Compartilhando sem audio.", "info");
                }
            } catch (err) {
                console.warn("[ScreenShare] captura de audio da janela indisponivel:", err);
                pushToast("Audio da janela indisponivel. Compartilhando sem audio.", "info");
                audioTrack = null;
            }
        }

        const [videoTrack] = stream.getVideoTracks();

        if (!videoTrack) {
            stream.getTracks().forEach(track => track.stop());
            stopWindowAudio();
            return;
        }

        try {
            videoTrack.contentHint = "detail";
        } catch {

        }

        videoTrack.onended = () => {
            stopScreenShare();
        }

        const merged = new MediaStream([videoTrack, ...(audioTrack ? [audioTrack] : [])]);
        screenStreamRef.current = merged;
        setScreenStream(merged);

        webrtc.addScreenTrack(videoTrack, audioTrack ?? null, merged, quality?.height);
        send({ type: "screen-share", sharing: true });

    }

    function stopScreenShare() {
        if (!screenStreamRef.current) return;
        const stream = screenStreamRef.current;
        stream?.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
        setScreenStream(null);
        webrtc.removeScreenTrack(stream);
        stopWindowAudio();
        send({ type: "screen-share", sharing: false });
    }

    return { status, peers, send, localStream: localMedia.localStream, remoteStreams, switchMicrophone, peerMuted, peerSharing, remoteScreenStreams, remoteScreenAudioStreams, screenStream, startScreenShare, stopScreenShare };

}