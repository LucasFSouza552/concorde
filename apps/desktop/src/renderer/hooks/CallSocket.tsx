import type { ClientMessage, ForwardedDirectMessage, Peer, ServerMessage } from "@concorde/shared";

export type CallStatus = "idle" | "connecting" | "connected" | "failed";
export type SignalDropReason = "expired" | "stale-epoch" | "stale-generation";

interface CallSocketOptions {
    userId: string;
    username: string;
    onStatus: (status: CallStatus) => void;
    onPeers: (peers: Peer[]) => void;
    onPeerJoined: (peer: Peer) => void;
    onPeerLeft: (peerId: string) => void;
    onDirect: (message: ForwardedDirectMessage) => void;
    onReconnected?: () => void;
    onSignalError?: (reason: SignalDropReason, count: number) => void;
    getGeneration?: () => number;
}

export interface CallSocket {
    send: (message: ClientMessage) => void;
    close: () => void;
    retry: () => void;
}

interface OutboxContext {
    epoch: number | null;
    generation: number;
    now: number;
    ttl: number;
    max: number;
}

interface OutboxEntry {
    message: ClientMessage;
    epoch: number | null;
    generation: number;
    expiresAt: number;
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 10000;
const MAX_RECONNECT_ATTEMPTS = 10;
const SIGNAL_TTL_MS = 5000;
const MAX_OUTBOX_ENTRIES = 64;

export function outboxKey(message: ClientMessage): string {
    switch (message.type) {
        case "offer":
        case "answer":
            return `${message.type}:${message.to}`;
        case "ice-candidate":
            return `ice-candidate:${message.to}:${JSON.stringify(message.candidate)}`;
        case "screen-watch":
            return `screen-watch:${message.target}:${message.watching}`;
        default:
            return message.type;
    }
}

export function enqueueSignal(queue: OutboxEntry[], message: ClientMessage, context: OutboxContext): OutboxEntry[] {
    const key = outboxKey(message);
    const entry: OutboxEntry = {
        message,
        epoch: context.epoch,
        generation: context.generation,
        expiresAt: context.now + context.ttl
    };

    return [...queue.filter((item) => outboxKey(item.message) !== key), entry].slice(-context.max);
}

export function outboxDropReason(entry: OutboxEntry, context: OutboxContext): SignalDropReason | null {
    if (entry.expiresAt <= context.now) return "expired";
    if (entry.epoch !== null && context.epoch !== null && entry.epoch < context.epoch) return "stale-epoch";
    if (entry.generation < context.generation) return "stale-generation";
    return null;
}

export function createCallSocket(buildUrl: () => string, options: CallSocketOptions): CallSocket {
    let closedByUs = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let socket: WebSocket | null = null;
    let joinedOnThisSocket = false;
    let hasJoinedOnce = false;
    let currentEpoch = 0;
    let outbox: OutboxEntry[] = [];

    function outboxContext(): OutboxContext {
        return {
            epoch: currentEpoch > 0 ? currentEpoch : null,
            generation: options.getGeneration?.() ?? 0,
            now: Date.now(),
            ttl: SIGNAL_TTL_MS,
            max: MAX_OUTBOX_ENTRIES
        };
    }

    function drainOutbox() {
        if (!socket || socket.readyState !== WebSocket.OPEN || !joinedOnThisSocket) return;

        const context = outboxContext();
        const kept: OutboxEntry[] = [];
        let dropped = 0;
        let firstReason: SignalDropReason | null = null;

        for (const entry of outbox) {
            const reason = outboxDropReason(entry, context);

            if (reason) {
                dropped += 1;
                firstReason ??= reason;
                continue;
            }

            socket.send(JSON.stringify({ ...entry.message, epoch: currentEpoch } satisfies ClientMessage));
            kept.push(entry);
        }

        outbox = kept;

        if (dropped > 0) {
            options.onSignalError?.(firstReason ?? "expired", dropped);
        }
    }

    function open() {
        if (closedByUs) return;

        options.onStatus("connecting");
        joinedOnThisSocket = false;

        const ws = new WebSocket(buildUrl());
        socket = ws;

        ws.addEventListener("open", () => {
            attempt = 0;
            options.onStatus("connected");

            ws.send(JSON.stringify({
                type: "join",
                userId: options.userId,
                username: options.username
            } satisfies ClientMessage));
        });

        ws.addEventListener("message", (event) => {
            const message = JSON.parse(event.data) as ServerMessage;

            if (typeof message.epoch === "number") {
                currentEpoch = Math.max(currentEpoch, message.epoch);
            }

            if ("from" in message) {
                if (typeof message.epoch === "number" && message.epoch < currentEpoch) {
                    options.onSignalError?.("stale-epoch", 1);
                    return;
                }
                options.onDirect(message);
                return;
            }

            switch (message.type) {
                case "peers":
                    if (!joinedOnThisSocket) {
                        joinedOnThisSocket = true;
                        if (hasJoinedOnce) options.onReconnected?.();
                        hasJoinedOnce = true;
                        drainOutbox();
                    }
                    options.onPeers(message.peers);
                    break;
                case "peer-joined":
                    options.onPeerJoined(message.peer);
                    break;
                case "peer-left":
                    options.onPeerLeft(message.userId);
                    break;
            }
        });

        ws.addEventListener("close", (event) => {
            socket = null;
            joinedOnThisSocket = false;
            if (closedByUs) {
                options.onStatus("idle");
                return;
            }
            console.log("[call-socket] fechou:", event.code, event.reason || "(sem motivo)", "limpo:", event.wasClean);

            if (attempt >= MAX_RECONNECT_ATTEMPTS) {
                console.error(`[call-socket] desistindo após ${MAX_RECONNECT_ATTEMPTS} tentativas.`);
                options.onStatus("failed");
                return;
            }

            options.onStatus("connecting");
            const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS) * (0.5 + Math.random());
            attempt += 1;
            retryTimer = setTimeout(open, delay);
        });
    }

    open();

    return {
        close: () => {
            closedByUs = true;
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = null;
            outbox = [];
            options.onStatus("idle");
            socket?.close();
        },
        retry: () => {
            if (closedByUs) return;
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = null;
            attempt = 0;
            if (!socket || socket.readyState !== WebSocket.OPEN) open();
        },
        send: (message) => {
            if (socket?.readyState === WebSocket.OPEN && joinedOnThisSocket) {
                socket.send(JSON.stringify({ ...message, epoch: currentEpoch } satisfies ClientMessage));
                return;
            }

            outbox = enqueueSignal(outbox, message, outboxContext());
        }
    };
}
