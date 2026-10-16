import { PhoneIncoming } from "lucide-react";

import CallScreen from "../../../../../components/CallScreen/CallScreen";
import type { Friend } from "@concorde/shared";

import type { PeerCallState } from "../../../../../hooks/usePeerCallState";

import styles from "./ChatView.module.css";

interface CallAreaProps {
    friend: Friend;
    onBack?: () => void;
    showCall: boolean;
    peerCall: PeerCallState | null;
    chatHidden: boolean;
    onToggleChat: () => void;
    onJoin: (call: PeerCallState) => void;
}

export default function CallArea({ friend, onBack, showCall, peerCall, chatHidden, onToggleChat, onJoin }: CallAreaProps) {
    if (showCall) {
        return (
            <CallScreen
                layout="full"
                peerName={friend.displayName}
                onBack={onBack}
                chatAvailable
                chatOpen={!chatHidden}
                onToggleChat={onToggleChat}
            />
        );
    }

    if (peerCall) {
        return (
            <div className={styles.callWrap}>
                <CallScreen
                    layout="full"
                    peerName={friend.displayName}
                    onBack={onBack}
                    preview={{
                        peers: [{ userId: friend.id, username: friend.displayName }],
                        action: (
                            <button
                                type="button"
                                className={styles.joinIconBtn}
                                aria-label="Entrar na chamada"
                                title="Entrar na chamada"
                                onClick={() => onJoin(peerCall)}
                            >
                                <PhoneIncoming size={20} />
                            </button>
                        ),
                    }}
                />
            </div>
        );
    }

    return null;
}
