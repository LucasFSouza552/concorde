import { useCallback, useEffect, useState } from "react";

import type { Friend } from "@concorde/shared";

import { api, getErrorMessage } from "../api/api";
import { getStoredToken } from "../api/session";

export function useFriendsList() {
    const [friends, setFriends] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!getStoredToken()) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);

        try {
            const { data } = await api.get<{ friends: Friend[] }>("/friends");
            setFriends(data.friends);
        } catch (error) {
            setError(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const remove = useCallback(async (friendId: string) => {
        try {
            await api.delete(`/friends/friend/${friendId}`);
            await load();
        } catch (error) {
            setError(getErrorMessage(error));
        }
    }, [load]);

    return { friends, loading, error, load, remove };
}