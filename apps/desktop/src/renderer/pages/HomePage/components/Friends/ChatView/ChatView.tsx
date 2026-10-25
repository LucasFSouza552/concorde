import { useState } from "react";
import { ChevronLeft, Phone } from "lucide-react";

import type { Friend } from "@concorde/shared";
import { useActiveCall } from "../../../../../contexts/ActiveCallProvider";
import { useCallInviteState } from "../../../../../contexts/CallInviteProvider";
import { useToast } from "../../../../../contexts/ToastProvider";
import UserIdentity from '../UserIdentity';
import CallArea from "./CallArea";
import ChatInput from "./ChatInput";
import MessageList from "./MessageList";

import { getErrorMessage } from "../../../../../api/api";
import { useChannelMessages } from "../../../../../hooks/useChannelMessages";
import { usePeerCallState } from "../../../../../hooks/usePeerCallState";

import styles from "./ChatView.module.css";

interface ChatViewProps {
    channelId: string;
    friend: Friend;
    onBack?: () => void;
    showHeader?: boolean;
    /** Chamadas são renderizadas fora (CallUri central): aqui só chat. */
    centered?: boolean;
}

export default function ChatView({ channelId, friend, onBack, showHeader = true, centered = false }: ChatViewProps) {
    const { messages, loading, error: errorMessages, send, sending, cooling, remove } = useChannelMessages(channelId);
    const { dial, outgoing, joinGroupCall, joinedGroup } = useCallInviteState();
    const { groupId, peers } = useActiveCall();
    const { push } = useToast();
    const peerCall = usePeerCallState(friend.id);

    const [chatHidden, setChatHidden] = useState(false);

    async function handleDelete(messageId: string) {
        try {
            await remove(messageId);
        } catch {
            /* erro já foi toastado no hook */
        }
    }

    const inGroupCall = joinedGroup !== null && joinedGroup.callGroupId === groupId;

    const inCallWithFriend =
        !inGroupCall &&
        groupId !== null &&
        (peers.some((peer) => peer.userId === friend.id) ||
            (outgoing.status === "dialing" && outgoing.toUserId === friend.id));

    const showCall = centered ? false : (inCallWithFriend || (!inGroupCall && groupId !== null && peers.length === 0));
    const directPeerCall = peerCall && peerCall.concordeGroupId === null ? peerCall : null;
    const showPreview = centered ? false : (!showCall && !inCallWithFriend && directPeerCall !== null);
    const callVisible = centered ? false : (showCall || showPreview);

    async function handleCall(friend: Friend) {
        try {
            await dial(friend);
        } catch (error) {
            push(getErrorMessage(error), "error");
        }
    }

    return (
        <section className={styles.chat}>
            {(showCall || showPreview) && (
                <CallArea
                    friend={friend}
                    onBack={onBack}
                    showCall={showCall}
                    peerCall={showPreview ? directPeerCall : null}
                    chatHidden={chatHidden}
                    onToggleChat={() => setChatHidden((hidden) => !hidden)}
                    onJoin={(call) => joinGroupCall(call.groupId, call.concordeGroupId)}
                />
            )}
            {showHeader && !callVisible && !chatHidden && (
                <header className={styles.chatHeader}>
                    {onBack && (
                        <button type="button" onClick={onBack} className={styles.backBtn} aria-label="Voltar para amigos">
                            <ChevronLeft />
                        </button>
                    )}
                    <UserIdentity displayName={friend.displayName} username={friend.username} large />

                    {!callVisible && !inCallWithFriend && (
                        <button
                            type="button"
                            className={`${styles.iconBtn} ${styles.callBtn}`}
                            aria-label={`Ligar para ${friend.displayName}`}
                            onClick={() => handleCall(friend)}
                        >
                            <Phone />
                        </button>
                    )}
                </header>
            )}
            {!chatHidden && (
                <>
                    <MessageList
                        channelId={channelId}
                        friend={friend}
                        messages={messages}
                        loading={loading}
                        error={errorMessages}
                        onDelete={handleDelete}
                    />
                    <ChatInput sending={sending} cooling={cooling} send={send} />
                </>
            )}

        </section>
    )
}
