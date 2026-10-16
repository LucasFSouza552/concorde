import type { ClientMessage, ForwardedDirectMessage, Peer, ServerMessage } from "@concorde/shared";

export type CallStatus = "idle" | "connecting" | "connected";

interface CallSocketOptions {
    userId: string;
    username: string;
    onStatus: (status: CallStatus) => void;
    onPeers: (peers: Peer[]) => void;
    onPeerJoined: (peer: Peer) => void;
    onPeerLeft: (peerId: string) => void;
    onDirect: (message: ForwardedDirectMessage) => void;
}

export interface CallSocket {
    send: (message: ClientMessage) => void;
    close: () => void;
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 10000;

export function createCallSocket(url: string, options: CallSocketOptions): CallSocket {
    let closedByUs = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let socket: WebSocket | null = null;

    function open() {
        if (closedByUs) return;

        options.onStatus("connecting");

        const ws = new WebSocket(url);
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

            if ("from" in message) {
                options.onDirect(message);
                return;
            }

            switch (message.type) {
                case "peers":
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
            if (closedByUs) {
                options.onStatus("idle");
                return;
            }
            console.log("[call-socket] fechou:", event.code, event.reason || "(sem motivo)", "limpo:", event.wasClean);
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
            options.onStatus("idle");
            socket?.close();
        },
        send: (message) => {
            if (!socket || socket.readyState !== WebSocket.OPEN) return;

            socket.send(JSON.stringify(message));
        }
    }
}
