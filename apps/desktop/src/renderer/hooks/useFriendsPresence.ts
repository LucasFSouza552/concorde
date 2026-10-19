import { useEffect, useState } from "react";

import type { Friend, UserStatus } from "@concorde/shared";
import { useUserSocketEvent } from "../contexts/UserSocketProvider";

import { api } from "../api/api";

const PRESENCE_REFRESH_MS = 15_000;

export interface FriendPresence {
    status: UserStatus;
    inCall: boolean;
    groupId: string | null;
    concordeGroupId: string | null;
}

export function useFriendsPresence(friends: Friend[]): Map<string, FriendPresence> {
    const [presences, setPresences] = useState<Map<string, FriendPresence>>(new Map());
    const [refreshKey, setRefreshKey] = useState(0);
    const lastEvent = useUserSocketEvent();

    useEffect(() => {
        const timer = window.setInterval(
            () => setRefreshKey((current) => current + 1),
            PRESENCE_REFRESH_MS,
        );

        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            const next = new Map<string, FriendPresence>();

            await Promise.all(friends.map(async (friend) => {
                try {
                    const { data } = await api.get<FriendPresence>(`/user/${friend.id}/presence`);
                    next.set(friend.id, data);
                } catch {
                    /* ignore */
                }
            }));

            if (!cancelled) setPresences(next);
        })();

        return () => {
            cancelled = true;
        };
    }, [friends, refreshKey]);

    useEffect(() => {
        if (!lastEvent) return;
        if (lastEvent.type !== "peer-status" && lastEvent.type !== "peer-call-state") return;

        const { userId } = lastEvent;

        // O delta chega por WebSocket, como mensagem externa, e precisa ser
        // aplicado assim que o evento chega — sem esperar o próximo polling.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPresences((current) => {
            const existing = current.get(userId) ?? {
                status: "offline" as UserStatus,
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