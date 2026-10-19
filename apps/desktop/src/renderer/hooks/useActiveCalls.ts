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
    const [refreshKey, setRefreshKey] = useState(0);
    const lastEvent = useUserSocketEvent();
    const { groupId: currentCallId } = useActiveCall();

    const callStateEvent = useMemo(
        () => (lastEvent && lastEvent.type === "peer-call-state" ? lastEvent : null),
        [lastEvent],
    );

    useEffect(() => {
        const timer = window.setInterval(
            () => setRefreshKey((current) => current + 1),
            ACTIVE_CALLS_REFRESH_MS,
        );

        return () => {
            window.clearInterval(timer);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            const membersByGroup = new Map<string, string[]>();

            await Promise.all(groups.map(async (group) => {
                try {
                    const { data } = await api.get<{ members: { id: string }[] }>(`/groups/${group.id}/members`);
                    membersByGroup.set(group.id, data.members.map((member) => member.id));
                } catch {
                    /* ignore */
                }
            }));

            const userIds = new Set<string>();
            membersByGroup.forEach((ids) => ids.forEach((id) => userIds.add(id)));
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
                const members = membersByGroup.get(group.id) ?? [];
                const callId = members
                    .map((id) => presences.get(id))
                    .find((presence) => presence?.inCall && presence.groupId && presence.concordeGroupId === group.id)
                    ?.groupId;

                if (!callId) continue;

                nextVoiceGroups.add(group.id);

                const isCurrent = callId === currentCallId;
                const count = members.filter((id) => presences.get(id)?.groupId === callId).length;
                taken.add(callId);

                nextCalls.push({
                    key: `group-${group.id}`,
                    callGroupId: callId,
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
    }, [groups, friends, callStateEvent, refreshKey, currentCallId]);

    return { calls, voiceGroupIds };
}
