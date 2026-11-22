import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Friend, FriendRelationshipResponse, FriendRelationshipState, MutualFriendsResponse } from "@concorde/shared";

import { api, getErrorMessage } from "../api/api";
import { useAuth } from "../contexts/AuthContext";
import { useUserSocketEvent } from "../contexts/UserSocketProvider";
import { useFriendsList } from "./useFriendsList";

const SOCIAL_CACHE_TTL = 5 * 60 * 1000;

interface CachedValue<T> {
    value: T;
    at: number;
}

const relationshipCache = new Map<string, CachedValue<FriendRelationshipState>>();
const relationshipRequests = new Map<string, Promise<FriendRelationshipState>>();
const mutualCache = new Map<string, CachedValue<string[]>>();
const mutualRequests = new Map<string, Promise<string[]>>();

function socialKey(viewerId: string, targetId: string): string {
    return `${viewerId}:${targetId}`;
}

function readCache<T>(cache: Map<string, CachedValue<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (!entry || Date.now() - entry.at > SOCIAL_CACHE_TTL) return null;
    return entry.value;
}

function writeCache<T>(cache: Map<string, CachedValue<T>>, key: string, value: T): void {
    cache.set(key, { value, at: Date.now() });
}

function fetchRelationship(key: string, targetId: string): Promise<FriendRelationshipState> {
    const pending = relationshipRequests.get(key);
    if (pending) return pending;

    const request = api.get<FriendRelationshipResponse>(`/friends/relationship/${encodeURIComponent(targetId)}`)
        .then(({ data }) => {
            writeCache(relationshipCache, key, data.state);
            return data.state;
        })
        .finally(() => {
            relationshipRequests.delete(key);
        });

    relationshipRequests.set(key, request);
    return request;
}

function fetchMutualIds(key: string, targetId: string): Promise<string[]> {
    const pending = mutualRequests.get(key);
    if (pending) return pending;

    const request = api.get<MutualFriendsResponse>(`/friends/mutual/${encodeURIComponent(targetId)}`)
        .then(({ data }) => {
            writeCache(mutualCache, key, data.ids);
            return data.ids;
        })
        .finally(() => {
            mutualRequests.delete(key);
        });

    mutualRequests.set(key, request);
    return request;
}

export function invalidateProfileSocialCache(): void {
    relationshipCache.clear();
    mutualCache.clear();
}

export interface SocialHookState {
    loading: boolean;
    error: string | null;
    reload: (force?: boolean) => Promise<void>;
}

export function useFriendRelationship(targetId: string, enabled = true): SocialHookState & {
    state: FriendRelationshipState | null;
    setState: (state: FriendRelationshipState) => void;
} {
    const { user } = useAuth();
    const key = socialKey(user?.id ?? "anon", targetId);
    const cached = readCache(relationshipCache, key);
    const [state, setState] = useState<FriendRelationshipState | null>(cached);
    const [loading, setLoading] = useState(enabled && cached === null);
    const [error, setError] = useState<string | null>(null);
    const lastEvent = useUserSocketEvent();
    const seenEvent = useRef(lastEvent);

    const reload = useCallback(async (force = false) => {
        if (!enabled) return;

        const cachedState = force ? null : readCache(relationshipCache, key);
        if (cachedState !== null) {
            setState(cachedState);
            setError(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            setState(await fetchRelationship(key, targetId));
        } catch (cause) {
            setError(getErrorMessage(cause));
        } finally {
            setLoading(false);
        }
    }, [enabled, key, targetId]);

    useEffect(() => {
        void reload();
    }, [reload]);

    useEffect(() => {
        if (lastEvent === seenEvent.current) return;
        seenEvent.current = lastEvent;
        if (lastEvent?.type !== "friends-changed") return;
        invalidateProfileSocialCache();
        const timer = setTimeout(() => { void reload(true); }, 0);
        return () => clearTimeout(timer);
    }, [lastEvent, reload]);

    useEffect(() => {
        if (!enabled) return;
        function handleFocus() { void reload(); }
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [enabled, reload]);

    const updateState = useCallback((next: FriendRelationshipState) => {
        writeCache(relationshipCache, key, next);
        setState(next);
    }, [key]);

    return { state, setState: updateState, loading, error, reload };
}

export function useMutualFriends(targetId: string, enabled = true): SocialHookState & {
    friends: Friend[];
    ids: string[];
} {
    const { user } = useAuth();
    const { friends, loading: friendsLoading } = useFriendsList();
    const key = socialKey(user?.id ?? "anon", targetId);
    const cached = readCache(mutualCache, key);
    const [ids, setIds] = useState<string[]>(cached ?? []);
    const [loading, setLoading] = useState(enabled && cached === null);
    const [error, setError] = useState<string | null>(null);
    const lastEvent = useUserSocketEvent();
    const seenEvent = useRef(lastEvent);

    const reload = useCallback(async (force = false) => {
        if (!enabled) return;

        const cachedIds = force ? null : readCache(mutualCache, key);
        if (cachedIds !== null) {
            setIds(cachedIds);
            setError(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            setIds(await fetchMutualIds(key, targetId));
        } catch (cause) {
            setError(getErrorMessage(cause));
        } finally {
            setLoading(false);
        }
    }, [enabled, key, targetId]);

    useEffect(() => {
        void reload();
    }, [reload]);

    useEffect(() => {
        if (lastEvent === seenEvent.current) return;
        seenEvent.current = lastEvent;
        if (lastEvent?.type !== "friends-changed") return;
        invalidateProfileSocialCache();
        const timer = setTimeout(() => { void reload(true); }, 0);
        return () => clearTimeout(timer);
    }, [lastEvent, reload]);

    useEffect(() => {
        if (!enabled) return;
        function handleFocus() { void reload(); }
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [enabled, reload]);

    const mutualFriends = useMemo(() => {
        const byId = new Map(friends.map((friend) => [friend.id, friend]));
        return ids.map((id) => byId.get(id)).filter((friend): friend is Friend => Boolean(friend));
    }, [friends, ids]);

    return { friends: mutualFriends, ids, loading: loading || friendsLoading, error, reload };
}
