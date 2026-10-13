import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Phone, PhoneIncoming } from "lucide-react";

import CallScreen from "../../../../../components/CallScreen/CallScreen";
import type { Friend } from "@concorde/shared";
import { useActiveCall } from "../../../../../contexts/ActiveCallProvider";
import { useAuth } from "../../../../../contexts/AuthContext";
import { useCallInviteState } from "../../../../../contexts/CallInviteProvider";
import { useToast } from "../../../../../contexts/ToastProvider";
import { useUserSocketEvent } from "../../../../../contexts/UserSocketProvider";
import UserIdentity from '../UserIdentity';

import { ConvertTimeStampToHM } from "../../../../../utils/timeConverter";
import { api, getErrorMessage } from "../../../../../api/api";
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
    const { dial, outgoing } = useCallInviteState();
    const { groupId, peers, join } = useActiveCall();
    const { user } = useAuth();
    const lastEvent = useUserSocketEvent();
    const listRef = useRef<HTMLDivElement | null>(null);

    const inCallWithFriend =
        groupId !== null &&
        (peers.some((peer) => peer.userId === friend.id) ||
            (outgoing.status === "dialing" && outgoing.toUserId === friend.id));

    const showCall = inCallWithFriend || (groupId !== null && peers.length === 0);

    const [peerCallGroupId, setPeerCallGroupId] = useState<string | null>(null);
    const callVisible = showCall || (!inCallWithFriend && peerCallGroupId !== null);

    useEffect(() => {
        let cancelled = false;
        setPeerCallGroupId(null);

        api.get<{ inCall: boolean; groupId: string | null }>(`/user/${friend.id}/presence`)
            .then(({ data }) => {
                if (cancelled) return;
                setPeerCallGroupId(data.inCall ? data.groupId : null);
            })
            .catch(() => { });

        return () => {
            cancelled = true;
        };
    }, [friend.id]);

    useEffect(() => {
        if (!lastEvent || lastEvent.type !== "peer-call-state") return;
        if (lastEvent.userId !== friend.id) return;
        setPeerCallGroupId(lastEvent.groupId);
    }, [lastEvent, friend.id]);

    const { push } = useToast();

    const [draft, setDraft] = useState("");
    const [chatHidden, setChatHidden] = useState(false);

    async function handleSend() {
        const text = draft.trim();
        if (!text || sending || cooling) return;

        setDraft("");
        try {
            await send(text);
        } catch (error) {
            setDraft(text);
            push(getErrorMessage(error), "error");
        }
    }

    async function handleCall(friend: Friend) {
        try {
            await dial(friend);
        } catch (error) {
            push(getErrorMessage(error), "error");
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
            {showCall && (
                <CallScreen
                    layout="full"
                    peerName={friend.displayName}
                    onBack={onBack}
                    chatAvailable
                    chatOpen={!chatHidden}
                    onToggleChat={() => setChatHidden((hidden) => !hidden)}
                />
            )}
            {showHeader && !callVisible && !chatHidden && (
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
            {!chatHidden && (
                <>
                    {loading && <span>Carregando...</span>}
                    {errorMessages && <p>{errorMessages}</p>}
            {!inCallWithFriend && peerCallGroupId && (
                <CallScreen
                    layout="full"
                    peerName={friend.displayName}
                    onBack={onBack}
                    preview={{
                                peers: [{ userId: friend.id, username: friend.displayName }],
                                action: (
                                    <button
                                        type="button"
                                        className={styles.joinCallBtn}
                                        onClick={() => join(peerCallGroupId)}
                                    >
                                        <PhoneIncoming size={16} />
                                        Entrar na chamada
                                    </button>
                                ),
                            }}
                        />
                    )}

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
                </>
            )}

        </section>
    )
}