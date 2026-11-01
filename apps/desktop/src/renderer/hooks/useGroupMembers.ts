import { useCallback, useEffect, useState } from "react";

import { api, getErrorMessage } from "../api/api";

export interface GroupMemberItem {
    id: string;
    username: string;
    displayName: string;
    avatar?: string | null;
    bannerFrom?: string | null;
    bannerTo?: string | null;
    role: string;
    joinedAt: number;
}

/** Cache entre montagens: evita refazer GET /groups/:id/members a cada abertura. */
const MEMBER_CACHE = new Map<string, { members: GroupMemberItem[]; fetchedAt: number }>();

const CACHE_TTL_MS = 15_000;

export function useGroupMembers(groupId: string | null) {
    const [members, setMembers] = useState<GroupMemberItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (force = false) => {
        if (!groupId) {
            setMembers([]);
            return;
        }

        const cached = MEMBER_CACHE.get(groupId);
        if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
            setMembers(cached.members);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data } = await api.get<{ members: GroupMemberItem[] }>(`/groups/${groupId}/members`);
            MEMBER_CACHE.set(groupId, { members: data.members, fetchedAt: Date.now() });
            setMembers(data.members);
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        } finally {
            setLoading(false);
        }
    }, [groupId]);

    useEffect(() => {
        void load();
    }, [groupId, load]);

    return { members, loading, error, load };
}

/** Invalida o cache do grupo (após adicionar/remover membro, por exemplo). */
export function invalidateGroupMembers(groupId: string) {
    MEMBER_CACHE.delete(groupId);
}
