import { useEffect, useRef, useState } from "react";

import type { UserSocketServerMessage } from "@concorde/shared";
import { useAuth } from "../contexts/AuthContext";

import { WS_BASE_URL } from "../api/api";
import { getStoredToken } from "../api/session";

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

export function useUserSocket() {
    const [lastEvent, setLastEvent] = useState<UserSocketServerMessage | null>(null);
    const [connected, setConnected] = useState(false);
    const socketRef = useRef<WebSocket | null>(null);
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;
        const token = getStoredToken();

        if (!token) return;

        let stopped = false;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        let attempt = 0;
        let socket: WebSocket | null = null;

        function connect() {
            if (stopped || !user) return;

            const ws = new WebSocket(`${WS_BASE_URL}/user/${user.id}/socket`);
            socket = ws;
            socketRef.current = ws;

            ws.addEventListener("open", () => {
                if (stopped) {
                    ws.close();
                    return;
                }
                attempt = 0;
                setConnected(true);
                ws.send(JSON.stringify({ type: "auth", token: token }));
            });

            ws.addEventListener("message", (event) => {
                try {
                    setLastEvent(JSON.parse(event.data));
                } catch {

                }
            });

            ws.addEventListener("close", () => {
                if (stopped) return;
                setConnected(false);
                const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
                attempt += 1;
                retryTimer = setTimeout(connect, delay);
            });
        }

        connect();

        return () => {
            stopped = true;
            if (retryTimer) clearTimeout(retryTimer);
            socketRef.current = null;
            try {
                socket?.close();
            } catch {

            }
        }
    }, [user]);

    return {
        lastEvent,
        connected,
    };
}