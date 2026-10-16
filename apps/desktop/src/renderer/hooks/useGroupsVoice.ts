import { useEffect, useState } from "react";

import { useUserSocketEvent } from "../contexts/UserSocketProvider";

import { api } from "../api/api";

export function useGroupsVoice(groups: { id: string }[]) {
    const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
    const [tick, setTick] = useState(0);
    const lastEvent = useUserSocketEvent();

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            const active = new Set<string>();

            await Promise.all(groups.map(async (group) => {
                try {
                    const { data } = await api.get<{ members: { id: string }[] }>(`/groups/${group.id}/members`);
                    const checks = await Promise.all(data.members.map(async (member) => {
                        try {
                            const { data } = await api.get<{ inCall: boolean; concordeGroupId: string | null }>(`/user/${member.id}/presence`);
                            return data.inCall && data.concordeGroupId === group.id;
                        } catch {
                            return false;
                        }
                    }));
                    if (checks.some(Boolean)) active.add(group.id);
                } catch {
                    /* ignore */
                }
            }));

            if (!cancelled) setActiveIds(active);
        })();

        return () => {
            cancelled = true;
        };
    }, [groups, tick]);

    useEffect(() => {
        if (!lastEvent || lastEvent.type !== "peer-call-state") return;
        setTick((current) => current + 1);
    }, [lastEvent]);

    return activeIds;
}
