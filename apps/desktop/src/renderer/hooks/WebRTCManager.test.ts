import { describe, expect, it } from "vitest";

import { buildIceServers, iceRestartDelay, parsePeerStats, peerStatsSignature, selectCandidatePair } from "./WebRTCManager";

type StatsEntry = Record<string, unknown>;

class FakeStatsReport {
    private entries: Map<string, StatsEntry>;

    constructor(entries: Map<string, StatsEntry>) {
        this.entries = entries;
    }

    values() {
        return this.entries.values();
    }

    get(id: string) {
        return this.entries.get(id);
    }
}

function reportOf(entries: Record<string, StatsEntry>): RTCStatsReport {
    return new FakeStatsReport(new Map(Object.entries(entries))) as unknown as RTCStatsReport;
}

describe("recuperação de conexão WebRTC", () => {
    it("aplica backoff exponencial com teto nos ICE restarts", () => {
        expect(iceRestartDelay(0)).toBe(0);
        expect(iceRestartDelay(1)).toBe(5000);
        expect(iceRestartDelay(2)).toBe(10_000);
        expect(iceRestartDelay(3)).toBe(20_000);
        expect(iceRestartDelay(4)).toBe(30_000);
        expect(iceRestartDelay(10)).toBe(30_000);
    });

    it("mantém apenas STUN quando TURN não está configurado", () => {
        expect(buildIceServers({})).toEqual([
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
        ]);
    });

    it("adiciona TURN configurável com credenciais opcionais", () => {
        const servers = buildIceServers({
            VITE_TURN_URLS: " turn:turn.example.com:3478 , turns:turn.example.com:5349 ",
            VITE_TURN_USERNAME: " concorde ",
            VITE_TURN_CREDENTIAL: "segredo"
        });

        expect(servers).toHaveLength(3);
        expect(servers[2]).toEqual({
            urls: ["turn:turn.example.com:3478", "turns:turn.example.com:5349"],
            username: "concorde",
            credential: "segredo"
        });
    });
});

describe("métricas reais de WebRTC", () => {
    it("seleciona o candidate-pair nominado em vez de um par succeeded qualquer", () => {
        const report = reportOf({
            old: { type: "candidate-pair", state: "succeeded", nominated: false, currentRoundTripTime: 0.2 },
            current: { type: "candidate-pair", state: "succeeded", nominated: true, currentRoundTripTime: 0.05 }
        });

        expect(selectCandidatePair(report)).toMatchObject({ currentRoundTripTime: 0.05 });
    });

    it("separa áudio e vídeo e calcula bitrate a partir de bytes reais", () => {
        const previousReport = reportOf({
            outVideo: { type: "outbound-rtp", kind: "video", bytesSent: 500 }
        });
        const previous = parsePeerStats(previousReport, null, "checking", "connecting", 1000);

        const report = reportOf({
            current: { type: "candidate-pair", state: "succeeded", nominated: true, currentRoundTripTime: 0.05 },
            inAudio: {
                type: "inbound-rtp",
                kind: "audio",
                jitter: 0.012,
                packetsLost: 2,
                packetsReceived: 100,
                bytesReceived: 800,
                codecId: "audioCodec"
            },
            outVideo: {
                type: "outbound-rtp",
                kind: "video",
                bytesSent: 1000,
                framesPerSecond: 30,
                framesDropped: 4,
                codecId: "videoCodec",
                qualityLimitationReason: "bandwidth"
            },
            audioCodec: { type: "codec", mimeType: "audio/opus" },
            videoCodec: { type: "codec", mimeType: "video/H264" }
        });

        const stats = parsePeerStats(report, previous, "connected", "connected", 2000);

        expect(stats.rttMs).toBe(50);
        expect(stats.iceState).toBe("connected");
        expect(stats.connectionState).toBe("connected");
        expect(stats.audio.inbound.jitterMs).toBe(12);
        expect(stats.audio.inbound.packetsLost).toBe(2);
        expect(stats.audio.inbound.codec).toBe("audio/opus");
        expect(stats.audio.inbound.bitrateBps).toBeNull();
        expect(stats.video.outbound.bitrateBps).toBe(4000);
        expect(stats.video.outbound.framesPerSecond).toBe(30);
        expect(stats.video.outbound.framesDropped).toBe(4);
        expect(stats.video.outbound.codec).toBe("video/H264");
        expect(stats.video.outbound.qualityLimitationReason).toBe("bandwidth");
        expect(peerStatsSignature(previous)).not.toBe(peerStatsSignature(stats));
    });

    it("mantém métricas indisponíveis como null", () => {
        const stats = parsePeerStats(reportOf({}), null, null, null, 3000);

        expect(stats.rttMs).toBeNull();
        expect(stats.audio.inbound.bitrateBps).toBeNull();
        expect(stats.video.outbound.codec).toBeNull();
        expect(stats.video.outbound.framesPerSecond).toBeNull();
    });
});
