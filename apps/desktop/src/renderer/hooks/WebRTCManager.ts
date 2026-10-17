import type { ClientMessage } from "@concorde/shared";

const RTC_CONFIG: RTCConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
    ],
};

interface WebRTCManagerOptions {
    emit: (message: ClientMessage) => void;
    onRemoteStream: (peerId: string, stream: MediaStream) => void;
    getLocalStream: () => MediaStream | null;

    onRemoteScreenStream: (peerId: string, stream: MediaStream) => void;
    onRemoteScreenAudio: (peerId: string, stream: MediaStream) => void;
    getScreenStream: () => MediaStream | null;
    shouldOffer: (peerId: string) => boolean;
}

const ICE_RESTART_COOLDOWN_MS = 5000;
const SCREEN_TOTAL_BITRATE = 8_000_000;
const MIC_MAX_BITRATE = 32_000;

export function createWebRTCManager(options: WebRTCManagerOptions) {
    const { emit, onRemoteStream, getLocalStream, shouldOffer, getScreenStream, onRemoteScreenStream, onRemoteScreenAudio } = options;

    const connections = new Map<string, RTCPeerConnection>();
    const pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
    const negotiating = new Set<string>();
    const lastRestart = new Map<string, number>();
    const screenAudioTrackIds = new Set<string>();

    async function applyMicSendParams(connection: RTCPeerConnection) {
        const sender = connection.getSenders().find(
            (s) => s.track?.kind === "audio" && !screenAudioTrackIds.has(s.track.id)
        );
        if (!sender) return;
        try {
            const params = sender.getParameters();
            if (!params.encodings?.length) params.encodings = [{}];
            params.encodings[0].maxBitrate = MIC_MAX_BITRATE;
            await sender.setParameters(params);
        } catch (err) {
            console.warn("[Mic] Falha ao aplicar bitrate:", err);
        }
    }

    function createConnection(peerId: string) {
        const connection = new RTCPeerConnection(RTC_CONFIG);

        const stream = getLocalStream();

        if (stream) {
            stream.getTracks().forEach((track) => {
                connection.addTrack(track, stream);
            });
        }

        const screen = getScreenStream();

        if (screen) {
            screen.getTracks().forEach((track) => {
                if (track.kind === "audio") {
                    screenAudioTrackIds.add(track.id);
                }
                connection.addTrack(track, screen);
            });
        }

        connection.ontrack = (event) => {
            const [remote] = event.streams;

            if (!remote) {
                console.warn(`ontrack sem stream de ${peerId}`);
                return;
            }
            if (event.track.kind === "video") {
                onRemoteScreenStream(peerId, remote);
            } else if (remote.getVideoTracks().length > 0) {
                onRemoteScreenAudio(peerId, remote);
            } else {
                onRemoteStream(peerId, remote);
            }
        }

        connection.onconnectionstatechange = () => {
            if (connection.connectionState === "failed") {
                console.warn(`[WebRTC] Conexão com ${peerId} falhou. Tentando ICE restart…`);
                void restartIce(peerId);
            } else if (connection.connectionState === "closed") {
                removePeer(peerId);
            }
        };

        connection.oniceconnectionstatechange = () => {
            if (connection.iceConnectionState === "failed") {
                void restartIce(peerId);
            }
        };

        connection.onicecandidate = (event) => {
            if (!event.candidate) return;

            emit({ type: "ice-candidate", to: peerId, candidate: event.candidate.toJSON() } satisfies ClientMessage);
        }

        connection.onnegotiationneeded = () => {
            if (connection.signalingState !== "stable") return;
            if (shouldOffer(peerId)) {
                startOffer(peerId);
            }
        };

        connections.set(peerId, connection);

        const screenTrack = screen?.getVideoTracks()[0];
        if (screenTrack) {
            void applyScreenSendParams(connection, screenTrack, screenTrack.getSettings().height ?? 720);
        }

        return connection;
    }

    function flushCandidates(peerId: string) {
        const connection = connections.get(peerId);
        const queued = pendingCandidates.get(peerId);

        if (!connection || !queued) return;

        queued.forEach((candidate) => connection.addIceCandidate(candidate).catch(console.error));

        pendingCandidates.delete(peerId);
    }

    function handleOffer(peerId: string, sdp: string) {
        const connection = connections.get(peerId) ?? createConnection(peerId);

        connection.setRemoteDescription({ type: "offer", sdp })
            .then(() => connection.createAnswer())
            .then((answer) => connection.setLocalDescription(answer))
            .then(() => {
                emit({
                    type: "answer",
                    to: peerId,
                    sdp: connection.localDescription!.sdp
                } satisfies ClientMessage);

                flushCandidates(peerId);
                void applyMicSendParams(connection);
            })
            .catch(console.error);
    }

    function handleAnswer(peerId: string, sdp: string) {
        connections.get(peerId)
            ?.setRemoteDescription({ type: "answer", sdp })
            .then(() => {
                flushCandidates(peerId)
            })
            .catch(console.error);
    }

    function handleCandidate(peerId: string, candidate: RTCIceCandidateInit) {
        const connection = connections.get(peerId);

        if (!connection?.remoteDescription) {
            const queued = pendingCandidates.get(peerId) ?? [];

            pendingCandidates.set(peerId, [...queued, candidate]);
            return;
        }

        connection.addIceCandidate(candidate).catch(console.error);
    }

    function beginNegotiation(peerId: string): boolean {
        if (negotiating.has(peerId)) return false;
        negotiating.add(peerId);
        return true;
    }

    function sendOffer(peerId: string) {
        const connection = connections.get(peerId) ?? createConnection(peerId);

        connection.createOffer()
            .then((offer) => connection.setLocalDescription(offer))
            .then(() => {
                emit({
                    type: "offer",
                    to: peerId,
                    sdp: connection.localDescription!.sdp
                } satisfies ClientMessage)

                void applyMicSendParams(connection);
            })
            .catch(console.error)
            .finally(() => {
                negotiating.delete(peerId);
            });
    }

    function startOffer(peerId: string) {
        if (!beginNegotiation(peerId)) return;
        sendOffer(peerId);
    }

    function restartIce(peerId: string) {
        const connection = connections.get(peerId);
        if (!connection || !beginNegotiation(peerId)) return;

        const last = lastRestart.get(peerId) ?? 0;
        if (Date.now() - last < ICE_RESTART_COOLDOWN_MS) {
            negotiating.delete(peerId);
            return;
        }
        lastRestart.set(peerId, Date.now());

        connection.createOffer({ iceRestart: true })
            .then((offer) => connection.setLocalDescription(offer))
            .then(() => {
                emit({
                    type: "offer",
                    to: peerId,
                    sdp: connection.localDescription!.sdp
                } satisfies ClientMessage)

                void applyMicSendParams(connection);
            })
            .catch(console.error)
            .finally(() => {
                negotiating.delete(peerId);
            });
    }

    function removePeer(peerId: string) {
        connections.get(peerId)?.close();
        connections.delete(peerId);
        pendingCandidates.delete(peerId);
        negotiating.delete(peerId);
        refreshScreenBitrates();
    }

    function replaceAudioTrack(track: MediaStreamTrack) {
        connections.forEach((connection) => {
            connection.getSenders().forEach((sender) => {
                if (sender.track?.kind !== "audio") return;
                if (screenAudioTrackIds.has(sender.track.id)) return;
                sender.replaceTrack(track);
            });
        });
    }

    function screenMaxBitrate(height: number, peers: number): number {
        const cap = height >= 1080 ? 4_000_000 : height >= 720 ? 2_500_000 : 1_500_000;
        const floor = height >= 1080 ? 1_500_000 : height >= 720 ? 1_000_000 : 800_000;
        const perPeer = Math.floor(SCREEN_TOTAL_BITRATE / Math.max(1, peers));
        return Math.max(floor, Math.min(cap, perPeer));
    }

    async function applyScreenSendParams(connection: RTCPeerConnection, track: MediaStreamTrack, height: number) {
        const sender = connection.getSenders().find((s) => s.track === track);
        if (!sender) return;
        try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
                params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = screenMaxBitrate(height, connections.size);
            (params as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference = "maintain-resolution";
            await sender.setParameters(params);
        } catch (err) {
            console.warn("[ScreenShare] Falha ao aplicar bitrate:", err);
        }
    }

    function addScreenTrack(track: MediaStreamTrack, audioTrack: MediaStreamTrack | null, stream: MediaStream, height?: number) {
        const sendHeight = height ?? track.getSettings().height ?? 720;
        for (const [peerId, connection] of connections) {
            connection.addTrack(track, stream);
            if (audioTrack) {
                screenAudioTrackIds.add(audioTrack.id);
                connection.addTrack(audioTrack, stream);
            }
            void applyScreenSendParams(connection, track, sendHeight);
            startOffer(peerId);
        }
    }

    function removeScreenTrack(stream: MediaStream | null) {
        const ids = new Set((stream?.getTracks() ?? []).map((track) => track.id));
        ids.forEach((id) => screenAudioTrackIds.delete(id));
        for (const [peerId, connection] of connections) {
            connection.getSenders().forEach((sender) => {
                if (sender.track && ids.has(sender.track.id)) {
                    connection.removeTrack(sender);
                }
            });
            startOffer(peerId);
        }
    }

    function refreshScreenBitrates() {
        const videoTrack = getScreenStream()?.getVideoTracks()[0];
        if (!videoTrack) return;
        const height = videoTrack.getSettings().height ?? 720;
        for (const connection of connections.values()) {
            void applyScreenSendParams(connection, videoTrack, height);
        }
    }

    function closeAll() {
        connections.forEach((connection) => connection.close());
        connections.clear();
        pendingCandidates.clear();
        negotiating.clear();
        screenAudioTrackIds.clear();
    }

    return {
        handleOffer,
        handleAnswer,
        handleCandidate,
        startOffer,
        removePeer,
        replaceAudioTrack,
        closeAll,

        addScreenTrack,
        removeScreenTrack
    };

}