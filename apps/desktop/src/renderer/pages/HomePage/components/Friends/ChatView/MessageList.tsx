import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

import type { Friend } from "@concorde/shared";
import { useAuth } from "../../../../../contexts/AuthContext";

import { ConvertTimeStampToDateTime } from "../../../../../utils/timeConverter";
import type { LocalMessage } from "../../../../../hooks/useChannelMessages";

import styles from "./ChatView.module.css";

interface MessageListProps {
    channelId: string;
    friend: Friend;
    messages: LocalMessage[];
    loading: boolean;
    error: string | null;
    onDelete?: (messageId: string) => Promise<void>;
}

export default function MessageList({ channelId, friend, messages, loading, error, onDelete }: MessageListProps) {
    const { user } = useAuth();
    const listRef = useRef<HTMLDivElement | null>(null);
    const [armedId, setArmedId] = useState<string | null>(null);
    const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        listRef.current?.scrollTo({
            top: listRef.current.scrollHeight,
            behavior: "smooth"
        });
    }, [messages, channelId]);

    useEffect(() => {
        return () => {
            if (armTimer.current) clearTimeout(armTimer.current);
        };
    }, []);

    function arm(messageId: string) {
        if (armTimer.current) clearTimeout(armTimer.current);
        setArmedId(messageId);
        armTimer.current = setTimeout(() => setArmedId(null), 3000);
    }

    function handleDelete(message: LocalMessage) {
        if (!onDelete) return;

        if (armedId !== message.id) {
            arm(message.id);
            return;
        }

        setArmedId(null);
        void onDelete(message.id);
    }

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
                                    <small>{ConvertTimeStampToDateTime(message.createdAt)}</small>
                                    {message.pending && <small className={styles.messagePendingHint}>enviando…</small>}
                                    {isMine && onDelete && !message.pending && (
                                        <button
                                            type="button"
                                            className={`${styles.messageDeleteBtn} ${armedId === message.id ? styles.messageDeleteArmed : ""}`}
                                            title={armedId === message.id ? "Clique novamente para confirmar" : "Excluir mensagem"}
                                            aria-label={armedId === message.id ? "Confirmar exclusão da mensagem" : "Excluir mensagem"}
                                            onMouseLeave={() => { if (armedId === message.id) setArmedId(null); }}
                                            onClick={() => handleDelete(message)}
                                        >
                                            <Trash2 size={12} />
                                            {armedId === message.id ? "Confirmar?" : ""}
                                        </button>
                                    )}
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
