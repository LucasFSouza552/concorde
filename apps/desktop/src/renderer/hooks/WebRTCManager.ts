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
    getScreenStream: () => MediaStream | null;
    shouldOffer: (peerId: string) => boolean;
}

export function createWebRTCManager(options: WebRTCManagerOptions) {
    const { emit, onRemoteStream, getLocalStream, shouldOffer, getScreenStream, onRemoteScreenStream } = options;

    const connections = new Map<string, RTCPeerConnection>();
    const pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
    const negotiating = new Set<string>();

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
            } else {
                onRemoteStream(peerId, remote);
            }
        }

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

    function removePeer(peerId: string) {
        connections.get(peerId)?.close();
        connections.delete(peerId);
        pendingCandidates.delete(peerId);
        negotiating.delete(peerId);
    }

    function replaceAudioTrack(track: MediaStreamTrack) {
        connections.forEach((connection) => {
            connection.getSenders().forEach((sender) => {
                if (sender.track?.kind === "audio") {
                    sender.replaceTrack(track);
                }
            });
        });
    }

    function screenMaxBitrate(height: number): number {
        if (height >= 1080) return 10_000_000;
        if (height >= 720) return 5_000_000;
        return 2_500_000;
    }

    async function applyScreenSendParams(connection: RTCPeerConnection, track: MediaStreamTrack, height: number) {
        const sender = connection.getSenders().find((s) => s.track === track);
        if (!sender) return;
        try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
                params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = screenMaxBitrate(height);
            (params as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference = "maintain-resolution";
            await sender.setParameters(params);
        } catch (err) {
            console.warn("[ScreenShare] Falha ao aplicar bitrate:", err);
        }
    }

    function addScreenTrack(track: MediaStreamTrack, stream: MediaStream, height?: number) {
        const sendHeight = height ?? track.getSettings().height ?? 720;
        for (const [peerId, connection] of connections) {
            connection.addTrack(track, stream);
            void applyScreenSendParams(connection, track, sendHeight);
            startOffer(peerId);
        }
    }

    function removeScreenTrack() {
        for (const [peerId, connection] of connections) {
            connection.getSenders().forEach((sender) => {
                if (sender.track?.kind === "video") {
                    connection.removeTrack(sender);
                }
            });
            startOffer(peerId);
        }
    }

    function closeAll() {
        connections.forEach((connection) => connection.close());
        connections.clear();
        pendingCandidates.clear();
        negotiating.clear();
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