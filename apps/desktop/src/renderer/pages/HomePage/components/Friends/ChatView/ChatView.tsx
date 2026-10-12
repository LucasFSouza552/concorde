import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Phone } from "lucide-react";

import type { Friend } from "@concorde/shared";
import { useAuth } from "../../../../../contexts/AuthContext";
import { useCallInviteState } from "../../../../../contexts/CallInviteProvider";
import UserIdentity from '../UserIdentity';

import { ConvertTimeStampToHM } from "../../../../../utils/timeConverter";
import { getErrorMessage } from "../../../../../api/api";
import { useChannelMessages } from "../../../../../hooks/useChannelMessages";

import styles from "./ChatView.module.css";

interface ChatViewProps {
    channelId: string;
    friend: Friend;
    onBack?: () => void;
    showHeader?: boolean;
}

export default function ChatView({ channelId, friend, onBack, showHeader = true }: ChatViewProps) {
    const { messages, loading, error: errorMessages, send, sending, cooling } = useChannelMessages(channelId);
    const [sendError, setSendError] = useState<string | null>(null);
    const { dial } = useCallInviteState();
    const { user } = useAuth();
    const listRef = useRef<HTMLDivElement | null>(null);

    const [draft, setDraft] = useState("");

    async function handleSend() {
        setSendError(null);
        const text = draft.trim();
        if (!text || sending || cooling) return;

        setDraft("");
        try {
            await send(text);
        } catch (error) {
            setDraft(text);
            setSendError(getErrorMessage(error));
        }
    }

    async function handleCall(friend: Friend) {
        try {
            await dial(friend);
        } catch (error) {
            setSendError(getErrorMessage(error));
        }
    }

    useEffect(() => {
        listRef.current?.scrollTo({
            top: listRef.current.scrollHeight,
            behavior: "smooth"
        });
    }, [messages, channelId]);

    return (
        <section className={styles.chat}>
            {showHeader && (
                <header className={styles.chatHeader}>
                    {onBack && (
                        <button type="button" onClick={onBack} className={styles.backBtn}>
                            <ChevronLeft />
                        </button>
                    )}
                    <UserIdentity displayName={friend.displayName} username={friend.username} />

                    <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.callBtn}`}
                        aria-label={`Ligar para ${friend.displayName}`}
                        onClick={() => handleCall(friend)}
                    >
                        <Phone />
                    </button>
                </header>
            )}
            {loading && <span>Carregando...</span>}
            {(sendError || errorMessages) && <p>{errorMessages || sendError}</p>}

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

            <div className={styles.chatInput}>
                <input className={styles.chatField} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escreva uma mensagem"
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            void handleSend();
                        }
                    }} />
                <button type="button" className={styles.sendBtn} disabled={sending || cooling} onClick={() => void handleSend()}>Enviar</button>
            </div>

        </section>
    )
}