import { useActiveCall } from "../../contexts/ActiveCallProvider";
import { useAuth } from "../../contexts/AuthContext";

import VoiceRow from "./VoiceRow";

export default function VoiceList() {
    const { groupId, peers, peerMuted, micMuted, deafened, speakingMap } = useActiveCall();
    const { user } = useAuth();

    if (!groupId) return null;

    return (
        <>
            <VoiceRow
                name={user?.displayName ?? "Você"}
                muted={micMuted || deafened}
                deafened={deafened}
                isLocal
                speaking={!!speakingMap["local"]}
            />
            {peers.map((peer) => (
                <VoiceRow
                    key={peer.userId}
                    name={peer.username}
                    muted={peerMuted[peer.userId]?.muted ?? false}
                    deafened={peerMuted[peer.userId]?.deafened ?? false}
                    speaking={!!speakingMap[peer.userId]}
                />
            ))}
        </>
    );
}
