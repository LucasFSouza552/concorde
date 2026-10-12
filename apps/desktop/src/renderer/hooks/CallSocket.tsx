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

export function createCallSocket(url: string, options: CallSocketOptions): CallSocket {
    const socket = new WebSocket(url);

    options.onStatus("connecting");

    socket.addEventListener("open", () => {
        options.onStatus("connected");

        socket.send(JSON.stringify({
            type: "join",
            userId: options.userId,
            username: options.username
        } satisfies ClientMessage));
    });

    socket.addEventListener("message", (event) => {
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

    socket.addEventListener("close", () => options.onStatus("idle"));

    return {
        close: () => socket.close(),
        send: (message) => {
            if (socket.readyState !== WebSocket.OPEN) return;

            socket.send(JSON.stringify(message));
        }
    }
} 