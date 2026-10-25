import { useEffect, useState } from "react";

import type {
    Friend,
    PresenceBatchResponse,
    UserPresence,
    UserSocketServerMessage,
    UserStatus
} from "@concorde/shared";

import { useUserSocketConnected, useUserSocketEvent } from "../contexts/UserSocketProvider";

import { api } from "../api/api";

// Deltas chegam por WS; o sweep é só rede de segurança — mantido lento
// para poupar requisições/D1/DO no provider (cota do free tier).
const SAFETY_REFRESH_MS = 15 * 60_000;
// Ao (re)conectar o WS, espera o socket estabilizar antes de sincronizar.
const RECONNECT_DEBOUNCE_MS = 2_000;

export type FriendPresence = UserPresence;

type Listener = (snapshot: Map<string, FriendPresence>) => void;

// Store de módulo: 1 estado, 1 timer e 1 fetch compartilhados entre todos
// os consumidores do hook (SideBar, Home, Friends, QuickCallModal etc.).
let presences = new Map<string, FriendPresence>();
const listeners = new Set<Listener>();

let source: Friend[] | null = null;
let sourceKey = "";
let refCount = 0;
let connected = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let sweepTimer: ReturnType<typeof setInterval> | null = null;
let inflight = false;
let lastEventProcessed: UserSocketServerMessage | null = null;

function notify() {
    for (const listener of listeners) {
        listener(presences);
    }
}

function sourceKeyOf(friends: Friend[]): string {
    return friends.map((friend) => friend.id).sort().join(",");
}

async function fetchSnapshot() {
    const ids = source ? source.map((friend) => friend.id) : [];
    if (ids.length === 0 || inflight) return;

    inflight = true;

    const fetched = new Map<string, FriendPresence>();

    try {
        if (ids.length <= 1) {
            await Promise.all(ids.map(async (id) => {
                try {
                    const { data } = await api.get<UserPresence>(`/user/${id}/presence`);
                    fetched.set(id, data);
                } catch {
                    /* ignore */
                }
            }));
        } else {
            try {
                const { data } = await api.post<PresenceBatchResponse>("/user/presence/batch", { ids });

                for (const [userId, presence] of Object.entries(data.presences)) {
                    fetched.set(userId, presence);
                }
            } catch {
                /* ignore */
            }
        }
    } finally {
        inflight = false;
    }

    if (fetched.size === 0) return;

    // Merge sobre o estado atual: não descarta deltas recebidos enquanto fetchia.
    presences = new Map([...presences, ...fetched]);
    notify();
}

function scheduleFetch(delay: number) {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    if (delay <= 0) {
        void fetchSnapshot();
        return;
    }

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void fetchSnapshot();
    }, delay);
}

function acquire() {
    refCount += 1;

    if (refCount === 1) {
        sweepTimer = setInterval(() => {
            void fetchSnapshot();
        }, SAFETY_REFRESH_MS);
        scheduleFetch(0);
    }
}

function release() {
    refCount = Math.max(0, refCount - 1);

    if (refCount === 0) {
        if (sweepTimer) {
            clearInterval(sweepTimer);
            sweepTimer = null;
        }
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    }
}

function setSource(next: Friend[]) {
    const key = sourceKeyOf(next);

    if (key === sourceKey) return;

    source = next;
    sourceKey = key;

    if (refCount > 0) scheduleFetch(0);
}

function setConnected(next: boolean) {
    if (next === connected) return;

    connected = next;

    // Reconexão (false -> true): só sincroniza com socket estável.
    if (connected && refCount > 0) scheduleFetch(RECONNECT_DEBOUNCE_MS);
}

function isPresenceDelta(event: UserSocketServerMessage): boolean {
    return event.type === "peer-status" || event.type === "peer-call-state";
}

function applyDelta(event: UserSocketServerMessage) {
    if (event.type !== "peer-status" && event.type !== "peer-call-state") return;

    const { userId } = event;
    const existing = presences.get(userId);

    const merged: FriendPresence = {
        status: "offline" as UserStatus,
        online: false,
        inCall: false,
        groupId: null,
        concordeGroupId: null,
        customMessage: null,
        ...existing,
        ...(event.type === "peer-status"
            ? { status: event.status, customMessage: event.customMessage ?? null }
            : {
                inCall: event.groupId !== null,
                groupId: event.groupId ?? null,
                concordeGroupId: event.concordeGroupId ?? null,
            })
    };

    const next = new Map(presences);
    next.set(userId, merged);
    presences = next;
    notify();
}

function syncEvent(event: UserSocketServerMessage | null) {
    if (!event || event === lastEventProcessed) return;

    if (!isPresenceDelta(event)) return;

    lastEventProcessed = event;
    applyDelta(event);
}

export function notifyPresenceRefresh(): void {
    if (refCount > 0) scheduleFetch(0);
}

export function useFriendsPresence(friends: Friend[]): Map<string, FriendPresence> {
    const [snapshot, setSnapshot] = useState(() => presences);
    const connected = useUserSocketConnected();
    const lastEvent = useUserSocketEvent();

    useEffect(() => {
        acquire();
        const listener: Listener = (next) => setSnapshot(next);

        listeners.add(listener);

        return () => {
            listeners.delete(listener);
            release();
        };
    }, []);

    useEffect(() => {
        setSource(friends);
    }, [friends]);

    useEffect(() => {
        setConnected(connected);
    }, [connected]);

    useEffect(() => {
        syncEvent(lastEvent);
    }, [lastEvent]);

    return snapshot;
}
