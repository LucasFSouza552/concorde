import { useEffect, useMemo, useRef, useState } from "react";

import type { Friend, GroupWithRole, PresenceBatchResponse, UserPresence } from "@concorde/shared";

import { useActiveCall } from "../contexts/ActiveCallProvider";
import { useUserSocketConnected, useUserSocketEvent } from "../contexts/UserSocketProvider";

import { api } from "../api/api";

// Deltas chegaram por WS; o sweep é rede de segurança lenta para poupar cota.
const SAFETY_REFRESH_MS = 15 * 60_000;
// Ao (re)conectar o WS, espera o socket estabilizar antes de sincronizar.
const RECONNECT_DEBOUNCE_MS = 2_000;

export interface Presence {
    status?: string;
    inCall?: boolean;
    groupId?: string | null;
    concordeGroupId?: string | null;
}

export interface ActiveCallEntry {
    key: string;
    callGroupId: string;
    concordeGroupId: string | null;
    kind: "group" | "dm";
    title: string;
    subtitle: string;
    isCurrent: boolean;
    group?: GroupWithRole;
    friend?: Friend;
}

export interface ActiveCallsResult {
    calls: ActiveCallEntry[];
    voiceGroupIds: Set<string>;
}

export function useActiveCalls(groups: GroupWithRole[], friends: Friend[]): ActiveCallsResult {
    const [presences, setPresences] = useState<Map<string, Presence>>(new Map());
    const [members, setMembers] = useState<Map<string, string[]>>(new Map());
    const connected = useUserSocketConnected();
    const lastEvent = useUserSocketEvent();
    const prevConnectedRef = useRef<boolean | undefined>(undefined);
    const { groupId: currentCallId } = useActiveCall();

    const groupsKey = useMemo(() => groups.map((group) => group.id).join(","), [groups]);

    // Lista de membros muda raramente: só recarrega quando a composição de grupos muda.
    // Cada /groups/:id/members são 2 queries D1, então NÃO pode rodar a cada ciclo.
    useEffect(() => {
        let cancelled = false;
        const next = new Map<string, string[]>();

        void (async () => {
            await Promise.all(groups.map(async (group) => {
                try {
                    const { data } = await api.get<{ members: { id: string }[] }>(`/groups/${group.id}/members`);
                    next.set(group.id, data.members.map((member) => member.id));
                } catch {
                    /* ignore */
                }
            }));

            if (!cancelled) setMembers(next);
        })();

        return () => {
            cancelled = true;
        };
    }, [groupsKey, groups]);

    // Snapshot completo de presença quando muda quem monitorar e sweep lento;
    // na reconexão do WS, sincroniza só depois do socket estabilizar (debounce).
    useEffect(() => {
        const ids = new Set<string>();
        members.forEach((groupIds) => groupIds.forEach((id) => ids.add(id)));
        friends.forEach((friend) => ids.add(friend.id));

        let cancelled = false;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

        const refresh = async () => {
            const fetched = new Map<string, Presence>();
            const idsList = [...ids];

            if (idsList.length <= 1) {
                await Promise.all(idsList.map(async (id) => {
                    try {
                        const { data } = await api.get<UserPresence>(`/user/${id}/presence`);
                        fetched.set(id, data);
                    } catch {
                        /* ignore */
                    }
                }));
            } else {
                try {
                    const { data } = await api.post<PresenceBatchResponse>("/user/presence/batch", { ids: idsList });

                    for (const [userId, presence] of Object.entries(data.presences)) {
                        fetched.set(userId, presence);
                    }
                } catch {
                    /* ignore */
                }
            }

            if (cancelled) return;

            // Merge sobre o estado atual: não descarta deltas recebidos enquanto fetchia.
            setPresences((current) => new Map([...current, ...fetched]));
        };

        const prevConnected = prevConnectedRef.current;
        prevConnectedRef.current = connected;
        const isReconnect = Boolean(prevConnected !== undefined && connected && !prevConnected);

        if (isReconnect) {
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                void refresh();
            }, RECONNECT_DEBOUNCE_MS);
        } else {
            void refresh();
        }

        const timer = window.setInterval(() => {
            void refresh();
        }, SAFETY_REFRESH_MS);

        return () => {
            cancelled = true;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            window.clearInterval(timer);
        };
    }, [members, friends, connected]);

    // Deltas em tempo real por WS, aplicados no ato — sem polling.
    useEffect(() => {
        if (!lastEvent) return;
        if (lastEvent.type !== "peer-status" && lastEvent.type !== "peer-call-state") return;

        // peer-status só altera status; NÃO pode zerar o estado de chamada.
        const patch: Partial<Presence> = lastEvent.type === "peer-status"
            ? { status: lastEvent.status }
            : { inCall: lastEvent.groupId !== null, groupId: lastEvent.groupId ?? null, concordeGroupId: lastEvent.concordeGroupId ?? null };

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPresences((current) => {
            const next = new Map(current);
            next.set(lastEvent.userId, { ...current.get(lastEvent.userId), ...patch });
            return next;
        });
    }, [lastEvent]);

    const { calls, voiceGroupIds } = useMemo(() => {
        const nextCalls: ActiveCallEntry[] = [];
        const nextVoiceGroups = new Set<string>();
        const taken = new Set<string>();

        for (const group of groups) {
            const ids = members.get(group.id) ?? [];
            const membersOfCallId = ids
                .map((id) => presences.get(id))
                .find((presence) => presence?.inCall && presence.groupId && presence.concordeGroupId === group.id)
                ?.groupId;

            if (!membersOfCallId) continue;

            nextVoiceGroups.add(group.id);

            const isCurrent = membersOfCallId === currentCallId;
            const count = ids.filter((id) => presences.get(id)?.groupId === membersOfCallId).length;
            taken.add(membersOfCallId);

            nextCalls.push({
                key: `group-${group.id}`,
                callGroupId: membersOfCallId,
                concordeGroupId: group.id,
                kind: "group",
                title: group.name,
                subtitle: isCurrent
                    ? "Você está na chamada"
                    : count > 1 ? `${count} na chamada` : "Em chamada",
                isCurrent,
                group,
            });
        }

        for (const friend of friends) {
            const presence = presences.get(friend.id);

            if (!presence?.inCall || !presence.groupId) continue;
            if (presence.concordeGroupId !== null) continue;
            // Chamada 1:1 é privada: só aparece se VOCÊ está nela — o
            // groupId do amigo precisa ser o da SUA chamada atual.
            if (presence.groupId !== currentCallId) continue;
            if (taken.has(presence.groupId)) continue;

            taken.add(presence.groupId);

            nextCalls.push({
                key: `dm-${friend.id}`,
                callGroupId: presence.groupId,
                concordeGroupId: null,
                kind: "dm",
                title: friend.displayName,
                subtitle: "Você está na chamada",
                isCurrent: true,
                friend,
            });
        }

        nextCalls.sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));

        return { calls: nextCalls, voiceGroupIds: nextVoiceGroups };
    }, [groups, members, friends, presences, currentCallId]);

    return { calls, voiceGroupIds };
}
