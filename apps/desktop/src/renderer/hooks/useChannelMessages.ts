import { useCallback, useEffect, useState } from "react";

import type { NewMessage } from "@concorde/shared";
import { useUserSocketEvent } from "../contexts/UserSocketProvider";

import { api, getErrorMessage } from "../api/api";

export function useChannelMessages(channelId: string | null) {
    const [messages, setMessages] = useState<NewMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const lastEvent = useUserSocketEvent();

    const load = useCallback(async () => {
        if (!channelId) {
            setMessages([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get<{ messages: NewMessage[] }>(`/channels/${channelId}/messages?limit=50`);
            setMessages(data.messages);
        } catch (error) {
            setError(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    }, [channelId]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (!lastEvent || lastEvent.type !== "channel-message") return;
        if (lastEvent.message.channelId !== channelId) return;

        setMessages((current) => {
            if (current.some((item) => item.id === lastEvent.message.id)) {
                return current;
            }
            return [lastEvent.message, ...current];
        });
    }, [lastEvent, channelId]);

    const send = useCallback(async (content: string) => {
        if (!channelId || !content.trim()) return;

        await api.post(`/channels/${channelId}/messages`, { content });
        await load();
    }, [channelId, load]);

    return { messages, loading, error, load, send };
}