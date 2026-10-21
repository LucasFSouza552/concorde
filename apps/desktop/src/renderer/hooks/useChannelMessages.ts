import { useCallback, useEffect, useRef, useState } from "react";

import type { NewMessage } from "@concorde/shared";
import { useAuth } from "../contexts/AuthContext";
import { useUserSocketEvent } from "../contexts/UserSocketProvider";
import { useToast } from "../contexts/ToastProvider";

import { api, getErrorMessage } from "../api/api";

const SEND_COOLDOWN_MS = 1500;

export interface LocalMessage extends NewMessage {
    pending?: boolean;
}

function appendMessage(current: LocalMessage[], message: LocalMessage) {
    if (current.some((item) => item.id === message.id)) {
        return current;
    }
    return [...current, message];
}

export function useChannelMessages(channelId: string | null) {
    const [messages, setMessages] = useState<LocalMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [cooling, setCooling] = useState(false);
    const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { user } = useAuth();
    const { push: pushToast } = useToast();
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

        setMessages((current) => appendMessage(current, lastEvent.message));
    }, [lastEvent, channelId]);

    useEffect(() => {
        if (!lastEvent || lastEvent.type !== "channel-message-deleted") return;
        if (lastEvent.channelId !== channelId) return;

        const { messageId } = lastEvent;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMessages((current) => current.filter((item) => item.id !== messageId));
    }, [lastEvent, channelId]);

    useEffect(() => {
        return () => {
            if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
        };
    }, []);

    const send = useCallback(async (content: string) => {
        if (!channelId || !content.trim() || sending || cooling) return;
        if (!user) throw new Error("Sessão expirada. Entre novamente.");

        const tempId = `temp-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
        const optimistic: LocalMessage = {
            id: tempId,
            channelId,
            userId: user.id,
            kind: "text",
            content: content.trim(),
            createdAt: Date.now(),
            pending: true,
        };

        setMessages((current) => appendMessage(current, optimistic));
        setSending(true);
        try {
            const { data } = await api.post<{ message: NewMessage }>(`/channels/${channelId}/messages`, { content });
            setMessages((current) => current.map((item) => (item.id === tempId ? data.message : item)));
            setCooling(true);
            if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
            cooldownTimer.current = setTimeout(() => setCooling(false), SEND_COOLDOWN_MS);
        } catch (error) {
            setMessages((current) => current.filter((item) => item.id !== tempId));
            throw error;
        } finally {
            setSending(false);
        }
    }, [channelId, sending, cooling, user]);

    const remove = useCallback(async (messageId: string) => {
        if (!channelId) return;

        try {
            await api.delete(`/channels/${channelId}/messages/${messageId}`);
            setMessages((current) => current.some((item) => item.id === messageId)
                ? current.filter((item) => item.id !== messageId)
                : current);
        } catch (error) {
            pushToast?.(getErrorMessage(error), "error");
            throw error;
        }
    }, [channelId, pushToast]);

    return { messages, loading, error, load, send, sending, cooling, remove };
}