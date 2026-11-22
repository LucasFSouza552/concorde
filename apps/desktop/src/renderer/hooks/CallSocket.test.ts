import { afterEach, describe, expect, it, vi } from "vitest";

import type { ForwardedDirectMessage, ServerMessage } from "@concorde/shared";
import {
    createCallSocket,
    enqueueSignal,
    outboxDropReason,
    type SignalDropReason
} from "./CallSocket";

type StubEvent = {
    code?: number;
    data?: string;
    reason?: string;
    wasClean?: boolean;
};

type StubListener = (event: StubEvent) => void;

class FakeWebSocket {
    static OPEN = 1;
    static instances: FakeWebSocket[] = [];

    url: string;
    readyState = 0;
    sent: string[] = [];
    private listeners = new Map<string, StubListener[]>();

    constructor(url: string) {
        this.url = url;
        FakeWebSocket.instances.push(this);
    }

    addEventListener(type: string, listener: StubListener) {
        const list = this.listeners.get(type) ?? [];
        list.push(listener);
        this.listeners.set(type, list);
    }

    emit(type: string, event: StubEvent = {}) {
        for (const listener of this.listeners.get(type) ?? []) listener(event);
    }

    send(data: string) {
        this.sent.push(data);
    }

    close() {
        this.readyState = 3;
        this.emit("close", { code: 1000, reason: "", wasClean: true });
    }
}

function socketOptions(overrides: Partial<Parameters<typeof createCallSocket>[1]> = {}) {
    return {
        userId: "local",
        username: "Local",
        onStatus: () => {},
        onPeers: () => {},
        onPeerJoined: () => {},
        onPeerLeft: () => {},
        onDirect: () => {},
        ...overrides
    };
}

afterEach(() => {
    vi.unstubAllGlobals();
    FakeWebSocket.instances = [];
});

describe("sinalização com WebSocket", () => {
    it("envia join e drena mensagens enfileiradas após a confirmação de peers", () => {
        vi.stubGlobal("WebSocket", FakeWebSocket);
        const direct: ForwardedDirectMessage[] = [];
        const socket = createCallSocket(() => "ws://test/call", socketOptions({
            onDirect: (message) => direct.push(message)
        }));

        socket.send({ type: "offer", to: "peer", sdp: "v=0" });

        const ws = FakeWebSocket.instances[0];
        expect(ws.sent).toHaveLength(0);

        ws.readyState = FakeWebSocket.OPEN;
        ws.emit("open");
        expect(ws.sent).toHaveLength(1);
        expect(ws.sent[0]).toContain('"type":"join"');

        ws.emit("message", { data: JSON.stringify({ type: "peers", peers: [], epoch: 1 }) });
        expect(ws.sent).toHaveLength(2);
        expect(ws.sent[1]).toContain('"type":"offer"');
        expect(ws.sent[1]).toContain('"epoch":1');

        ws.emit("message", { data: JSON.stringify({ type: "offer", from: "peer", sdp: "v=1", epoch: 1 }) });
        expect(direct).toHaveLength(1);

        socket.close();
    });

    it("descarta mensagens enfileiradas de epoch antigo", () => {
        vi.stubGlobal("WebSocket", FakeWebSocket);
        const drops: Array<[SignalDropReason, number]> = [];
        const socket = createCallSocket(() => "ws://test/call", socketOptions({
            onSignalError: (reason, count) => drops.push([reason, count])
        }));

        const first = FakeWebSocket.instances[0];
        first.readyState = FakeWebSocket.OPEN;
        first.emit("open");
        first.emit("message", { data: JSON.stringify({ type: "peers", peers: [], epoch: 5 }) });
        first.emit("close", { code: 1006, wasClean: false });

        socket.send({ type: "offer", to: "peer", sdp: "v=0" });
        socket.retry();

        const second = FakeWebSocket.instances[1];
        second.readyState = FakeWebSocket.OPEN;
        second.emit("open");
        second.emit("message", { data: JSON.stringify({ type: "peers", peers: [], epoch: 6 }) });

        expect(second.sent).toHaveLength(1);
        expect(drops).toEqual([["stale-epoch", 1]]);

        socket.close();
    });

    it("descarta mensagens enfileiradas de geração ICE antiga", () => {
        vi.stubGlobal("WebSocket", FakeWebSocket);
        let generation = 0;
        const drops: Array<[SignalDropReason, number]> = [];
        const socket = createCallSocket(() => "ws://test/call", socketOptions({
            getGeneration: () => generation,
            onSignalError: (reason, count) => drops.push([reason, count])
        }));

        socket.send({ type: "offer", to: "peer", sdp: "v=0", generation: 0 });
        generation = 2;

        const ws = FakeWebSocket.instances[0];
        ws.readyState = FakeWebSocket.OPEN;
        ws.emit("open");
        ws.emit("message", { data: JSON.stringify({ type: "peers", peers: [], epoch: 1 }) });

        expect(ws.sent).toHaveLength(1);
        expect(drops).toEqual([["stale-generation", 1]]);

        socket.close();
    });

    it("ignora mensagens diretas de epoch antigo", () => {
        vi.stubGlobal("WebSocket", FakeWebSocket);
        const direct: ServerMessage[] = [];
        const socket = createCallSocket(() => "ws://test/call", socketOptions({
            onDirect: (message) => direct.push(message)
        }));

        const ws = FakeWebSocket.instances[0];
        ws.readyState = FakeWebSocket.OPEN;
        ws.emit("open");
        ws.emit("message", { data: JSON.stringify({ type: "peers", peers: [], epoch: 4 }) });
        ws.emit("message", { data: JSON.stringify({ type: "offer", from: "peer", sdp: "old", epoch: 2 }) });
        ws.emit("message", { data: JSON.stringify({ type: "offer", from: "peer", sdp: "new", epoch: 4 }) });

        expect(direct).toHaveLength(1);
        expect(JSON.stringify(direct[0])).toContain("new");

        socket.close();
    });

    it("reenvia mute-state, screen-share e screen-watch após reconexão confirmada", () => {
        vi.stubGlobal("WebSocket", FakeWebSocket);
        const reconnect = vi.fn();
        const socket = createCallSocket(() => "ws://test/call", socketOptions({ onReconnected: reconnect }));

        const first = FakeWebSocket.instances[0];
        first.readyState = FakeWebSocket.OPEN;
        first.emit("open");
        first.emit("message", { data: JSON.stringify({ type: "peers", peers: [], epoch: 1 }) });
        expect(reconnect).not.toHaveBeenCalled();

        first.emit("close", { code: 1006, wasClean: false });
        socket.retry();
        const second = FakeWebSocket.instances[1];
        second.readyState = FakeWebSocket.OPEN;
        second.emit("open");
        second.emit("message", { data: JSON.stringify({ type: "peers", peers: [], epoch: 2 }) });

        expect(reconnect).toHaveBeenCalledTimes(1);

        socket.close();
    });
});

describe("outbox de sinalização", () => {
    const context = { epoch: 1, generation: 0, now: 10_000, ttl: 5000, max: 64 };

    it("substitui offer anterior para o mesmo peer", () => {
        const first = enqueueSignal([], { type: "offer", to: "peer", sdp: "old" }, context);
        const second = enqueueSignal(first, { type: "offer", to: "peer", sdp: "new" }, context);

        expect(second).toHaveLength(1);
        expect(second[0].message).toEqual({ type: "offer", to: "peer", sdp: "new" });
    });

    it("classifica entradas expiradas e obsoletas", () => {
        const entry = enqueueSignal([], { type: "offer", to: "peer", sdp: "v=0" }, context)[0];

        expect(outboxDropReason(entry, context)).toBeNull();
        expect(outboxDropReason(entry, { ...context, now: 15_001 })).toBe("expired");
        expect(outboxDropReason(entry, { ...context, epoch: 2 })).toBe("stale-epoch");
        expect(outboxDropReason(entry, { ...context, generation: 1 })).toBe("stale-generation");
    });
});
