import { useCallback, useEffect, useState } from "react";

import { api, getErrorMessage } from "../api/api";

export interface GroupMemberItem {
    id: string;
    username: string;
    displayName: string;
    role: string;
    joinedAt: number;
}

export function useGroupMembers(groupId: string | null) {
    const [members, setMembers] = useState<GroupMemberItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!groupId) {
            setMembers([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get<{ members: GroupMemberItem[] }>(`/groups/${groupId}/members`);
            setMembers(data.members);
        } catch (error) {
            setError(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    }, [groupId]);

    useEffect(() => {
        if (groupId) void load();
    }, [groupId, load]);

    return { members, loading, error, load };
}