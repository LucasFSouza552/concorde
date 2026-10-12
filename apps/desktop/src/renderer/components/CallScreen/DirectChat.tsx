import { useEffect, useState } from "react";

import type { Friend } from "@concorde/shared";

import { api, getErrorMessage } from "../../api/api";

import ChatView from "../../pages/HomePage/components/Friends/ChatView/ChatView";

interface DirectChatProps {
    userId: string;
    displayName: string;
}

export default function DirectChat({ userId, displayName }: DirectChatProps) {
    const [channelId, setChannelId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        api.post<{ channel: { id: string } }>("/channels/dm", { toUserId: userId })
            .then(({ data }) => {
                if (!cancelled) setChannelId(data.channel.id);
            })
            .catch((err: unknown) => {
                if (!cancelled) setError(getErrorMessage(err));
            });

        return () => {
            cancelled = true;
        };
    }, [userId]);

    if (error) {
        return <p>Não foi possível abrir a conversa.</p>;
    }

    if (!channelId) {
        return <span>Abrindo conversa...</span>;
    }

    const friend: Friend = { id: userId, username: displayName, displayName };

    return <ChatView channelId={channelId} friend={friend} showHeader={false} />;
}
