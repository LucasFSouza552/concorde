import { useEffect, useState } from "react";

import { useUserSocketEvent } from "../contexts/UserSocketProvider";

import { api } from "../api/api";

export interface PeerCallState {
    groupId: string;
    concordeGroupId: string | null;
}

export function usePeerCallState(friendId: string) {
    const [peerCall, setPeerCall] = useState<PeerCallState | null>(null);
    const lastEvent = useUserSocketEvent();

    useEffect(() => {
        let cancelled = false;
        setPeerCall(null);

        api.get<{ inCall: boolean; groupId: string | null; concordeGroupId: string | null }>(`/user/${friendId}/presence`)
            .then(({ data }) => {
                if (cancelled) return;
                setPeerCall(data.inCall && data.groupId ? { groupId: data.groupId, concordeGroupId: data.concordeGroupId } : null);
            })
            .catch(() => { });

        return () => {
            cancelled = true;
        };
    }, [friendId]);

    useEffect(() => {
        if (!lastEvent || lastEvent.type !== "peer-call-state") return;
        if (lastEvent.userId !== friendId) return;
        setPeerCall(lastEvent.groupId ? { groupId: lastEvent.groupId, concordeGroupId: lastEvent.concordeGroupId ?? null } : null);
    }, [lastEvent, friendId]);

    return peerCall;
}
