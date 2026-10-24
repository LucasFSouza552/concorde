import { useEffect, useState } from "react";

import type { Friend, PresenceBatchResponse, UserStatus, UserPresence } from "@concorde/shared";

import { useUserSocketConnected, useUserSocketEvent } from "../contexts/UserSocketProvider";

import { api } from "../api/api";

// Deltas chegam por WS; o sweep é só rede de segurança — mantido lento
// para poupar requisições/D1/DO no provider (cota do free tier).
const SAFETY_REFRESH_MS = 15 * 60_000;

export interface FriendPresence extends UserPresence { }

async function fetchSnapshot(friends: Friend[], cancelled: { current: boolean }, apply: (map: Map<string, FriendPresence>) => void) {
    const next = new Map<string, FriendPresence>();

    if (friends.length <= 1) {
        await Promise.all(friends.map(async (friend) => {
            try {
                const { data } = await api.get<UserPresence>(`/user/${friend.id}/presence`);
                next.set(friend.id, data);
            } catch {
                /* ignore */
            }
        }));
    } else {
        try {
            const { data } = await api.post<PresenceBatchResponse>("/user/presence/batch", {
                ids: friends.map((friend) => friend.id)
            });

            for (const [userId, presence] of Object.entries(data.presences)) {
                next.set(userId, presence);
            }
        } catch {
            /* ignore */
        }
    }

    if (!cancelled.current) apply(next);
}

export function useFriendsPresence(friends: Friend[]): Map<string, FriendPresence> {
    const [presences, setPresences] = useState<Map<string, FriendPresence>>(new Map());
    const connected = useUserSocketConnected();
    const lastEvent = useUserSocketEvent();

    // Snapshot completo apenas quando a lista muda, ao (re)conectar o WebSocket
    // e numa rede de segurança lenta — deltas em tempo real chegam por WS.
    useEffect(() => {
        const cancelled = { current: false };

        void fetchSnapshot(friends, cancelled, (next) => setPresences(next));

        const timer = window.setInterval(() => {
            void fetchSnapshot(friends, cancelled, (next) => setPresences(next));
        }, SAFETY_REFRESH_MS);

        return () => {
            cancelled.current = true;
            window.clearInterval(timer);
        };
    }, [friends, connected]);

    useEffect(() => {
        if (!lastEvent) return;
        if (lastEvent.type !== "peer-status" && lastEvent.type !== "peer-call-state") return;

        const { userId } = lastEvent;

        // O delta chega por WebSocket e é aplicado no ato — sem polling.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPresences((current) => {
            const existing = current.get(userId) ?? {
                status: "offline" as UserStatus,
                online: false,
                inCall: false,
                groupId: null,
                concordeGroupId: null,
            };

            const next = new Map(current);

            next.set(userId, lastEvent.type === "peer-status"
                ? { ...existing, status: lastEvent.status }
                : {
                    ...existing,
                    inCall: lastEvent.groupId !== null,
                    groupId: lastEvent.groupId ?? null,
                    concordeGroupId: lastEvent.concordeGroupId ?? null,
                });

            return next;
        });
    }, [lastEvent]);

    return presences;
}
