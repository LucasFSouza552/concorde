import type { ClientMessage } from "@concorde/shared";

export interface TurnEnv {
    VITE_TURN_URLS?: string;
    VITE_TURN_USERNAME?: string;
    VITE_TURN_CREDENTIAL?: string;
}

export function buildIceServers(env: TurnEnv = import.meta.env as unknown as TurnEnv): RTCIceServer[] {
    const servers: RTCIceServer[] = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
    ];

    const urls = (env.VITE_TURN_URLS ?? "")
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean);

    if (urls.length === 0) return servers;

    const server: RTCIceServer = { urls };
    const username = env.VITE_TURN_USERNAME?.trim();
    const credential = env.VITE_TURN_CREDENTIAL?.trim();
    if (username) server.username = username;
    if (credential) server.credential = credential;
    servers.push(server);

    return servers;
}

const RTC_CONFIG: RTCConfiguration = { iceServers: buildIceServers(import.meta.env as unknown as TurnEnv) };

interface WebRTCManagerOptions {
    emit: (message: ClientMessage) => void;
    onRemoteStream: (peerId: string, stream: MediaStream) => void;
    getLocalStream: () => MediaStream | null;

    onRemoteScreenStream: (peerId: string, stream: MediaStream) => void;
    onRemoteScreenAudio: (peerId: string, stream: MediaStream) => void;
    getScreenStream: () => MediaStream | null;
    shouldOffer: (peerId: string) => boolean;
    /** Latência por-par (getStats) para o indicador do CallScreen. */
    onPeerRtt?: (peerId: string, rttMs: number | null) => void;
    onPeerStats?: (peerId: string, stats: PeerStats) => void;
}

const ICE_RESTART_BASE_MS = 5000;
const ICE_RESTART_MAX_MS = 30_000;
const SCREEN_TOTAL_BITRATE = 8_000_000;
const MIC_MAX_BITRATE = 32_000;

type StatsEntry = Record<string, unknown>;

export interface PeerMediaDirectionStats {
    bytesSent: number | null;
    bytesReceived: number | null;
    packetsLost: number | null;
    packetsReceived: number | null;
    jitterMs: number | null;
    bitrateBps: number | null;
    framesPerSecond: number | null;
    framesDropped: number | null;
    codec: string | null;
    qualityLimitationReason: string | null;
}

export interface PeerStats {
    rttMs: number | null;
    audio: { inbound: PeerMediaDirectionStats; outbound: PeerMediaDirectionStats };
    video: { inbound: PeerMediaDirectionStats; outbound: PeerMediaDirectionStats };
    iceState: string | null;
    connectionState: string | null;
    timestamp: number;
}

function emptyDirectionStats(): PeerMediaDirectionStats {
    return {
        bytesSent: null,
        bytesReceived: null,
        packetsLost: null,
        packetsReceived: null,
        jitterMs: null,
        bitrateBps: null,
        framesPerSecond: null,
        framesDropped: null,
        codec: null,
        qualityLimitationReason: null
    };
}

function numberValue(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}

export function iceRestartDelay(attempt: number): number {
    if (!Number.isFinite(attempt) || attempt <= 0) return 0;
    return Math.min(ICE_RESTART_MAX_MS, ICE_RESTART_BASE_MS * 2 ** (attempt - 1));
}

export function selectCandidatePair(report: RTCStatsReport): StatsEntry | null {
    let fallback: StatsEntry | null = null;
    let legacy: StatsEntry | null = null;

    for (const raw of report.values()) {
        const entry = raw as StatsEntry;
        if (entry.type !== "candidate-pair") continue;

        const state = stringValue(entry.state);
        const hasRtt = numberValue(entry.currentRoundTripTime) !== null;

        if (entry.nominated === true && state === "succeeded" && hasRtt) return entry;
        if (state === "succeeded" && hasRtt && !fallback) fallback = entry;
        if (entry.selected === true && hasRtt && !legacy) legacy = entry;
    }

    return fallback ?? legacy;
}

function findRtpEntry(report: RTCStatsReport, kind: "audio" | "video", direction: "inbound" | "outbound"): StatsEntry | null {
    for (const raw of report.values()) {
        const entry = raw as StatsEntry;
        if (entry.type !== `${direction}-rtp`) continue;
        if (entry.kind !== kind) continue;
        return entry;
    }
    return null;
}

function directionStats(
    entry: StatsEntry | null,
    previous: PeerMediaDirectionStats | null,
    previousTimestamp: number | null,
    report: RTCStatsReport,
    direction: "inbound" | "outbound",
    timestamp: number
): PeerMediaDirectionStats {
    if (!entry) return emptyDirectionStats();

    const bytesSent = numberValue(entry.bytesSent);
    const bytesReceived = numberValue(entry.bytesReceived);
    const jitter = numberValue(entry.jitter);
    const currentBytes = direction === "outbound" ? bytesSent : bytesReceived;
    const previousBytes = direction === "outbound" ? previous?.bytesSent ?? null : previous?.bytesReceived ?? null;
    const elapsedSeconds = previousTimestamp !== null ? (timestamp - previousTimestamp) / 1000 : 0;
    const bitrateBps = currentBytes !== null && previousBytes !== null && elapsedSeconds > 0
        ? Math.max(0, Math.round(((currentBytes - previousBytes) * 8) / elapsedSeconds))
        : null;
    const codecId = stringValue(entry.codecId);
    const codec = codecId ? stringValue(report.get(codecId)?.mimeType) : null;

    return {
        bytesSent,
        bytesReceived,
        packetsLost: numberValue(entry.packetsLost),
        packetsReceived: numberValue(entry.packetsReceived),
        jitterMs: jitter === null ? null : Math.round(jitter * 1000),
        bitrateBps,
        framesPerSecond: numberValue(entry.framesPerSecond),
        framesDropped: numberValue(entry.framesDropped),
        codec,
        qualityLimitationReason: stringValue(entry.qualityLimitationReason)
    };
}

export function parsePeerStats(
    report: RTCStatsReport,
    previous: PeerStats | null,
    iceState: string | null,
    connectionState: string | null,
    timestamp = Date.now()
): PeerStats {
    const pair = selectCandidatePair(report);
    const rtt = pair ? numberValue(pair.currentRoundTripTime) : null;
    const audioInbound = findRtpEntry(report, "audio", "inbound");
    const audioOutbound = findRtpEntry(report, "audio", "outbound");
    const videoInbound = findRtpEntry(report, "video", "inbound");
    const videoOutbound = findRtpEntry(report, "video", "outbound");

    return {
        rttMs: rtt === null ? null : Math.round(rtt * 1000),
        audio: {
            inbound: directionStats(audioInbound, previous?.audio.inbound ?? null, previous?.timestamp ?? null, report, "inbound", timestamp),
            outbound: directionStats(audioOutbound, previous?.audio.outbound ?? null, previous?.timestamp ?? null, report, "outbound", timestamp)
        },
        video: {
            inbound: directionStats(videoInbound, previous?.video.inbound ?? null, previous?.timestamp ?? null, report, "inbound", timestamp),
            outbound: directionStats(videoOutbound, previous?.video.outbound ?? null, previous?.timestamp ?? null, report, "outbound", timestamp)
        },
        iceState,
        connectionState,
        timestamp
    };
}

export function peerStatsSignature(stats: PeerStats): string {
    const values: Array<number | string | null> = [
        stats.rttMs,
        stats.iceState,
        stats.connectionState,
        stats.audio.inbound.bitrateBps,
        stats.audio.inbound.jitterMs,
        stats.audio.inbound.packetsLost,
        stats.audio.inbound.codec,
        stats.audio.outbound.bitrateBps,
        stats.video.inbound.bitrateBps,
        stats.video.inbound.jitterMs,
        stats.video.inbound.packetsLost,
        stats.video.inbound.codec,
        stats.video.outbound.bitrateBps,
        stats.video.outbound.framesPerSecond,
        stats.video.outbound.framesDropped,
        stats.video.outbound.codec,
        stats.video.outbound.qualityLimitationReason
    ];

    return values.map((value) => value ?? "-").join("|");
}

export function createWebRTCManager(options: WebRTCManagerOptions) {
    const { emit, onRemoteStream, getLocalStream, shouldOffer, getScreenStream, onRemoteScreenStream, onRemoteScreenAudio, onPeerRtt, onPeerStats } = options;

    const connections = new Map<string, RTCPeerConnection>();
    const pendingCandidates = new Map<string, Array<{ candidate: RTCIceCandidateInit; generation: number }>>();
    const negotiating = new Set<string>();
    const restartAttempts = new Map<string, number>();
    const restartTimers = new Map<string, number>();
    const screenAudioTrackIds = new Set<string>();
    const shareTransceivers = new Map<string, RTCRtpTransceiver[]>();
    const shareReceiveDesired = new Map<string, boolean>();
    const shareSharingPeers = new Map<string, boolean>();

    const RTT_POLL_MS = 5000;
    const lastRtt = new Map<string, number | null>();
    const lastStats = new Map<string, PeerStats>();
    const remoteGeneration = new Map<string, number>();
    let mediaGeneration = 0;
    let statsTimer: number | null = null;

    function pollPeerStats() {
        connections.forEach((connection, peerId) => {
            void connection.getStats().then((report) => {
                const previous = lastStats.get(peerId) ?? null;
                const stats = parsePeerStats(
                    report,
                    previous,
                    connection.iceConnectionState,
                    connection.connectionState
                );

                lastStats.set(peerId, stats);

                if (!previous || peerStatsSignature(previous) !== peerStatsSignature(stats)) {
                    onPeerStats?.(peerId, stats);
                }

                if (lastRtt.get(peerId) !== stats.rttMs) {
                    lastRtt.set(peerId, stats.rttMs);
                    onPeerRtt?.(peerId, stats.rttMs);
                }
            }).catch(() => {
                if (lastRtt.get(peerId) === null) return;
                lastRtt.set(peerId, null);
                onPeerRtt?.(peerId, null);
            });
        });
    }

    statsTimer = window.setInterval(pollPeerStats, RTT_POLL_MS);

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

    function connectionHealthy(connection: RTCPeerConnection): boolean {
        return connection.connectionState === "connected"
            || connection.iceConnectionState === "connected"
            || connection.iceConnectionState === "completed";
    }

    function connectionUnhealthy(connection: RTCPeerConnection): boolean {
        return connection.connectionState === "failed"
            || connection.connectionState === "disconnected"
            || connection.iceConnectionState === "failed"
            || connection.iceConnectionState === "disconnected";
    }

    function clearRestartTimer(peerId: string) {
        const timer = restartTimers.get(peerId);
        if (timer === undefined) return;
        window.clearTimeout(timer);
        restartTimers.delete(peerId);
    }

    function resetRestartState(peerId: string) {
        clearRestartTimer(peerId);
        restartAttempts.delete(peerId);
    }

    function scheduleIceRestart(peerId: string, connection: RTCPeerConnection) {
        if (connections.get(peerId) !== connection || restartTimers.has(peerId)) return;

        const delay = iceRestartDelay(restartAttempts.get(peerId) ?? 0);
        if (delay === 0) {
            restartIce(peerId, connection);
            return;
        }

        const timer = window.setTimeout(() => {
            restartTimers.delete(peerId);
            if (connections.get(peerId) !== connection) return;
            restartIce(peerId, connection);
        }, delay);
        restartTimers.set(peerId, timer);
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
            preferH264(connection);
        }

        connection.ontrack = (event) => {
            const [remote] = event.streams;

            if (!remote) {
                console.warn(`ontrack sem stream de ${peerId}`);
                return;
            }
            if (event.track.kind === "video") {
                onRemoteScreenStream(peerId, remote);
                recordShareTransceiver(peerId, event.transceiver);
            } else if (remote.getVideoTracks().length > 0) {
                onRemoteScreenAudio(peerId, remote);
                recordShareTransceiver(peerId, event.transceiver);
            } else {
                onRemoteStream(peerId, remote);
            }
        }

        connection.onconnectionstatechange = () => {
            if (connection.connectionState === "closed") {
                removePeer(peerId);
                return;
            }
            if (connectionHealthy(connection)) {
                resetRestartState(peerId);
                return;
            }
            if (connectionUnhealthy(connection)) {
                console.warn(`[WebRTC] Conexão com ${peerId} instável. Tentando ICE restart…`);
                scheduleIceRestart(peerId, connection);
            }
        };

        connection.oniceconnectionstatechange = () => {
            if (connectionHealthy(connection)) {
                resetRestartState(peerId);
                return;
            }
            if (connectionUnhealthy(connection)) {
                scheduleIceRestart(peerId, connection);
            }
        };

        connection.onicecandidate = (event) => {
            if (!event.candidate) return;

            emit({
                type: "ice-candidate",
                to: peerId,
                candidate: event.candidate.toJSON(),
                generation: mediaGeneration
            } satisfies ClientMessage);
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

        const generation = remoteGeneration.get(peerId) ?? 0;

        queued
            .filter((item) => item.generation >= generation)
            .forEach((item) => connection.addIceCandidate(item.candidate).catch(console.error));

        pendingCandidates.delete(peerId);
    }

    function handleOffer(peerId: string, sdp: string, generation = 0) {
        const connection = connections.get(peerId) ?? createConnection(peerId);

        remoteGeneration.set(peerId, Math.max(remoteGeneration.get(peerId) ?? 0, generation));

        connection.setRemoteDescription({ type: "offer", sdp })
            .then(() => {
                preferH264(connection);
                return connection.createAnswer();
            })
            .then((answer) => connection.setLocalDescription(answer))
            .then(() => {
                emit({
                    type: "answer",
                    to: peerId,
                    sdp: connection.localDescription!.sdp,
                    generation: mediaGeneration
                } satisfies ClientMessage);

                flushCandidates(peerId);
                void applyMicSendParams(connection);
            })
            .catch(console.error);
    }

    function handleAnswer(peerId: string, sdp: string, generation = 0) {
        remoteGeneration.set(peerId, Math.max(remoteGeneration.get(peerId) ?? 0, generation));

        connections.get(peerId)
            ?.setRemoteDescription({ type: "answer", sdp })
            .then(() => {
                flushCandidates(peerId)
            })
            .catch(console.error);
    }

    function handleCandidate(peerId: string, candidate: RTCIceCandidateInit, generation = 0) {
        const connection = connections.get(peerId);
        const expectedGeneration = remoteGeneration.get(peerId) ?? 0;

        if (generation < expectedGeneration) return;

        if (!connection?.remoteDescription) {
            const queued = pendingCandidates.get(peerId) ?? [];

            pendingCandidates.set(peerId, [...queued, { candidate, generation }]);
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
                    sdp: connection.localDescription!.sdp,
                    generation: mediaGeneration
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

    function restartIce(peerId: string, connection = connections.get(peerId)) {
        if (!connection || connections.get(peerId) !== connection) return;
        clearRestartTimer(peerId);

        if (connectionHealthy(connection)) {
            resetRestartState(peerId);
            return;
        }
        if (!beginNegotiation(peerId)) return;

        const attempt = (restartAttempts.get(peerId) ?? 0) + 1;
        restartAttempts.set(peerId, attempt);
        mediaGeneration += 1;

        connection.createOffer({ iceRestart: true })
            .then((offer) => connection.setLocalDescription(offer))
            .then(() => {
                emit({
                    type: "offer",
                    to: peerId,
                    sdp: connection.localDescription!.sdp,
                    generation: mediaGeneration
                } satisfies ClientMessage)

                void applyMicSendParams(connection);
            })
            .catch((error) => {
                console.warn(`[WebRTC] Falha no ICE restart com ${peerId}:`, error);
                scheduleIceRestart(peerId, connection);
            })
            .finally(() => {
                negotiating.delete(peerId);
            });
    }

    function removePeer(peerId: string) {
        connections.get(peerId)?.close();
        connections.delete(peerId);
        pendingCandidates.delete(peerId);
        negotiating.delete(peerId);
        clearRestartTimer(peerId);
        restartAttempts.delete(peerId);
        shareTransceivers.delete(peerId);
        shareReceiveDesired.delete(peerId);
        shareSharingPeers.delete(peerId);
        lastRtt.delete(peerId);
        lastStats.delete(peerId);
        remoteGeneration.delete(peerId);
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

    function preferH264(connection: RTCPeerConnection) {
        if (typeof RTCRtpReceiver === "undefined" || !RTCRtpReceiver.getCapabilities) return;
        const capabilities = RTCRtpReceiver.getCapabilities("video");
        if (!capabilities?.codecs) return;

        const h264 = capabilities.codecs.filter((c) => c.mimeType.toLowerCase() === "video/h264");
        const others = capabilities.codecs.filter((c) => c.mimeType.toLowerCase() !== "video/h264");
        if (h264.length === 0) return;

        const preferredOrder = [...h264, ...others];

        for (const transceiver of connection.getTransceivers()) {
            if (
                transceiver.sender.track?.kind === "video" ||
                transceiver.receiver.track?.kind === "video"
            ) {
                try {
                    transceiver.setCodecPreferences(preferredOrder);
                } catch (err) {
                    console.warn("[WebRTC] Falha ao aplicar preferência H.264:", err);
                }
            }
        }
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
            preferH264(connection);
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

    function recordShareTransceiver(peerId: string, transceiver: RTCRtpTransceiver) {
        const list = shareTransceivers.get(peerId) ?? [];
        if (list.includes(transceiver)) return;
        list.push(transceiver);
        shareTransceivers.set(peerId, list);

        if (shareReceiveDesired.has(peerId)) applyShareReceive(peerId);
    }

    function applyShareReceive(peerId: string) {
        const connection = connections.get(peerId);
        if (!connection) return;

        const desired = shareReceiveDesired.get(peerId) ?? true;
        const sharing = shareSharingPeers.get(peerId) ?? false;
        let list = shareTransceivers.get(peerId);

        // Late joiner: o compartilhador pode ser o answerer da negociação,
        // então as m-lines de tela nunca entraram no SDP. Cria receptores
        // (video + audio) e renegocia — o answer anexa os senders remotos.
        if (sharing && desired && !list?.length) {
            try {
                const created = [
                    connection.addTransceiver("video", { direction: "recvonly" }),
                    connection.addTransceiver("audio", { direction: "recvonly" }),
                ];
                shareTransceivers.set(peerId, created);
                list = created;
            } catch (err) {
                console.warn("[WebRTC] Falha ao criar receptores de compartilhamento:", err);
            }
        }

        if (!list?.length) return;

        let changed = false;

        for (const transceiver of list) {
            const sends = !!transceiver.sender.track;
            const target: RTCRtpTransceiverDirection = desired
                ? (sends ? "sendrecv" : "recvonly")
                : (sends ? "sendonly" : "inactive");
            if (transceiver.direction === target) continue;
            try {
                transceiver.direction = target;
                changed = true;
            } catch {
                // transceiver parado — nada a fazer
            }
        }

        if (!changed) return;

        // Quem inicia a oferta renegocia; o outro lado é "puxado" pelo evento
        // screen-watch (o autor da transmissão reoferta) — se ambos oferecerem
        // ao mesmo tempo, o navegador entra em glare e o vídeo congela preto.
        if (shouldOffer(peerId)) {
            negotiateWhenStable(peerId, connection);
        }
    }

    function negotiateWhenStable(peerId: string, connection: RTCPeerConnection) {
        if (connection.signalingState === "stable") {
            startOffer(peerId);
            return;
        }

        const onChange = () => {
            if (connection.signalingState !== "stable") return;
            connection.removeEventListener("signalingstatechange", onChange);
            startOffer(peerId);
        };
        connection.addEventListener("signalingstatechange", onChange);
    }

    function setShareReceiveEnabled(peerId: string, enabled: boolean, sharing = false) {
        shareReceiveDesired.set(peerId, enabled);
        shareSharingPeers.set(peerId, sharing);
        applyShareReceive(peerId);
    }

    /**
     * Reoferta para `peerId` quando sou o autor da oferta (evita glare):
     * usado quando um espectador do outro lado atualizou a direção de
     * recepção — o autor da transmissão renegocia por ele e o answer
     * do espectador passa a refletir as direções locais dele.
     */
    function renegotiateShare(peerId: string) {
        const connection = connections.get(peerId);
        if (!connection) return;
        if (!shouldOffer(peerId)) return;

        negotiateWhenStable(peerId, connection);
    }

    function closeAll() {
        if (statsTimer) {
            window.clearInterval(statsTimer);
            statsTimer = null;
        }

        connections.forEach((connection) => connection.close());
        connections.clear();
        pendingCandidates.clear();
        negotiating.clear();
        restartTimers.forEach((timer) => window.clearTimeout(timer));
        restartTimers.clear();
        restartAttempts.clear();
        screenAudioTrackIds.clear();
        shareTransceivers.clear();
        shareReceiveDesired.clear();
        shareSharingPeers.clear();
        lastRtt.clear();
        lastStats.clear();
        remoteGeneration.clear();
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
        removeScreenTrack,
        setShareReceiveEnabled,
        renegotiateShare,
        getGeneration: () => mediaGeneration
    };

}