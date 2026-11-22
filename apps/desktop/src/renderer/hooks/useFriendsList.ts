import { useCallback, useEffect, useRef, useState } from "react";

import type { Friend } from "@concorde/shared";

import { api, getErrorMessage } from "../api/api";
import { getStoredToken } from "../api/session";
import { useAuth } from "../contexts/AuthContext";
import { useUserSocketEvent } from "../contexts/UserSocketProvider";

const FRIENDS_CACHE_TTL = 5 * 60 * 1000;

interface CachedFriends {
    friends: Friend[];
    at: number;
}

const friendsCache = new Map<string, CachedFriends>();
const friendsRequests = new Map<string, Promise<Friend[]>>();

function readCache(key: string): Friend[] | null {
    const entry = friendsCache.get(key);
    if (!entry || Date.now() - entry.at > FRIENDS_CACHE_TTL) return null;
    return entry.friends;
}

function fetchFriends(key: string): Promise<Friend[]> {
    const pending = friendsRequests.get(key);
    if (pending) return pending;

    const request = api.get<{ friends: Friend[] }>("/friends")
        .then(({ data }) => {
            friendsCache.set(key, { friends: data.friends, at: Date.now() });
            return data.friends;
        })
        .finally(() => {
            friendsRequests.delete(key);
        });

    friendsRequests.set(key, request);
    return request;
}

export function invalidateFriendsCache(): void {
    friendsCache.clear();
}

export function useFriendsList() {
    const { user } = useAuth();
    const key = user?.id ?? "anon";
    const cached = readCache(key);
    const [friends, setFriends] = useState<Friend[]>(cached ?? []);
    const [loading, setLoading] = useState(cached === null);
    const [error, setError] = useState<string | null>(null);
    const lastEvent = useUserSocketEvent();
    const seenEvent = useRef(lastEvent);

    const refresh = useCallback(async () => {
        if (!getStoredToken()) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            setFriends(await fetchFriends(key));
        } catch (cause) {
            setError(getErrorMessage(cause));
        } finally {
            setLoading(false);
        }
    }, [key]);

    const load = useCallback(async () => {
        if (!getStoredToken()) {
            setLoading(false);
            return;
        }

        const current = readCache(key);
        if (current) {
            setFriends(current);
            setError(null);
            setLoading(false);
            return;
        }

        await refresh();
    }, [key, refresh]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (lastEvent === seenEvent.current) return;
        seenEvent.current = lastEvent;
        if (lastEvent?.type !== "friends-changed") return;
        invalidateFriendsCache();
        const timer = setTimeout(() => { void refresh(); }, 0);
        return () => clearTimeout(timer);
    }, [lastEvent, refresh]);

    const remove = useCallback(async (friendId: string) => {
        try {
            await api.delete(`/friends/friend/${friendId}`);
            await refresh();
        } catch (cause) {
            setError(getErrorMessage(cause));
        }
    }, [refresh]);

    return { friends, loading, error, load, refresh, remove };
}
