import { useEffect, useRef } from "react";

import type { Friend } from "@concorde/shared";
import { useAuth } from "../../../../../contexts/AuthContext";

import { ConvertTimeStampToHM } from "../../../../../utils/timeConverter";
import type { LocalMessage } from "../../../../../hooks/useChannelMessages";

import styles from "./ChatView.module.css";

interface MessageListProps {
    channelId: string;
    friend: Friend;
    messages: LocalMessage[];
    loading: boolean;
    error: string | null;
}

export default function MessageList({ channelId, friend, messages, loading, error }: MessageListProps) {
    const { user } = useAuth();
    const listRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        listRef.current?.scrollTo({
            top: listRef.current.scrollHeight,
            behavior: "smooth"
        });
    }, [messages, channelId]);

    return (
        <>
            {loading && <span>Carregando...</span>}
            {error && <p>{error}</p>}
            <div ref={listRef} className={styles.chatMessages}>
                {[...messages].map((message) => {
                    const isMine = message.userId === user?.id;
                    const displayName = isMine
                        ? (user?.displayName ?? "?")
                        : friend.displayName;

                    return (
                        <div key={message.id} className={`${styles.messageRow} ${message.pending ? styles.messagePending : ""}`}>
                            <span className={styles.messageAvatar}>
                                {displayName.trim().charAt(0).toUpperCase() || "?"}
                            </span>
                            <div className={styles.messageBody}>
                                <div className={styles.messageHeader}>
                                    <strong>{displayName}</strong>
                                    <small>{ConvertTimeStampToHM(message.createdAt)}</small>
                                </div>
                                <p className={styles.messageText}>{message.content}</p>
                            </div>
                        </div>
                    )
                })}
            </div>
        </>
    );
}
