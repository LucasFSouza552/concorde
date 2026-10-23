import { useEffect, useMemo, useState } from "react";

import type { Friend, GroupWithRole } from "@concorde/shared";

import { useActiveCall } from "../contexts/ActiveCallProvider";
import { useUserSocketEvent } from "../contexts/UserSocketProvider";

import { api } from "../api/api";

const ACTIVE_CALLS_REFRESH_MS = 15_000;

interface Presence {
    inCall: boolean;
    groupId: string | null;
    concordeGroupId: string | null;
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
    const [calls, setCalls] = useState<ActiveCallEntry[]>([]);
    const [voiceGroupIds, setVoiceGroupIds] = useState<Set<string>>(new Set());
    const [members, setMembers] = useState<Map<string, string[]>>(new Map());
    const [refreshKey, setRefreshKey] = useState(0);
    const lastEvent = useUserSocketEvent();
    const { groupId: currentCallId } = useActiveCall();

    const callStateEvent = useMemo(
        () => (lastEvent && lastEvent.type === "peer-call-state" ? lastEvent : null),
        [lastEvent],
    );

    const groupsKey = useMemo(() => groups.map((group) => group.id).join(","), [groups]);

    useEffect(() => {
        const timer = window.setInterval(
            () => setRefreshKey((current) => current + 1),
            ACTIVE_CALLS_REFRESH_MS,
        );

        return () => {
            window.clearInterval(timer);
        };
    }, []);

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

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            const userIds = new Set<string>();
            members.forEach((ids) => ids.forEach((id) => userIds.add(id)));
            friends.forEach((friend) => userIds.add(friend.id));

            const presences = new Map<string, Presence>();

            await Promise.all([...userIds].map(async (userId) => {
                try {
                    const { data } = await api.get<Presence>(`/user/${userId}/presence`);
                    presences.set(userId, data);
                } catch {
                    /* ignore */
                }
            }));

            if (cancelled) return;

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
                if (taken.has(presence.groupId)) continue;

                taken.add(presence.groupId);

                nextCalls.push({
                    key: `dm-${friend.id}`,
                    callGroupId: presence.groupId,
                    concordeGroupId: null,
                    kind: "dm",
                    title: friend.displayName,
                    subtitle: presence.groupId === currentCallId
                        ? "Você está na chamada"
                        : "Chamada em andamento",
                    isCurrent: presence.groupId === currentCallId,
                    friend,
                });
            }

            nextCalls.sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));

            setCalls(nextCalls);
            setVoiceGroupIds(nextVoiceGroups);
        })();

        return () => {
            cancelled = true;
        };
    }, [groups, friends, members, callStateEvent, refreshKey, currentCallId]);

    return { calls, voiceGroupIds };
}
