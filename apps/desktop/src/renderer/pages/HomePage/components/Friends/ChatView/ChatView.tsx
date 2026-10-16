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
}

export default function ChatView({ channelId, friend, onBack, showHeader = true }: ChatViewProps) {
    const { messages, loading, error: errorMessages, send, sending, cooling } = useChannelMessages(channelId);
    const { dial, outgoing, joinGroupCall } = useCallInviteState();
    const { groupId, peers } = useActiveCall();
    const { push } = useToast();
    const peerCall = usePeerCallState(friend.id);

    const [chatHidden, setChatHidden] = useState(false);

    const inCallWithFriend =
        groupId !== null &&
        (peers.some((peer) => peer.userId === friend.id) ||
            (outgoing.status === "dialing" && outgoing.toUserId === friend.id));

    const showCall = inCallWithFriend || (groupId !== null && peers.length === 0);
    const showPreview = !showCall && !inCallWithFriend && peerCall !== null;
    const callVisible = showCall || showPreview;

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
                    peerCall={showPreview ? peerCall : null}
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
                    <MessageList
                        channelId={channelId}
                        friend={friend}
                        messages={messages}
                        loading={loading}
                        error={errorMessages}
                    />
                    <ChatInput sending={sending} cooling={cooling} send={send} />
                </>
            )}

        </section>
    )
}
