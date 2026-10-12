import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import type { Peer, ScreenQuality } from "@concorde/shared";

import type { CallStatus } from "../hooks/CallSocket";
import { useCall } from "../hooks/useCall";

interface ActiveCallContextData {
    groupId: string | null;
    status: CallStatus;
    peers: Peer[];
    peerMuted: Record<string, { muted: boolean; deafened: boolean }>;
    peerSharing: Record<string, boolean>;
    localStream: MediaStream | null;
    remoteStreams: Record<string, MediaStream>;
    join: (groupId: string) => void;
    leave: () => void;
    switchMicrophone: (next: MediaStream) => void;

    micMuted: boolean;
    deafened: boolean;
    toggleMic: () => void;
    toggleDeafen: () => void;

    screenStream: MediaStream | null;
    remoteScreenStreams: Record<string, MediaStream>;
    startScreenShare: (sourceId?: string, quality?: ScreenQuality, includeAudio?: boolean) => Promise<void>;
    stopScreenShare: () => void;
}

const ActiveCallContext = createContext<ActiveCallContextData | undefined>(undefined);

export function ActiveCallProvider({ children }: { children: ReactNode }) {
    const [groupId, setGroupId] = useState<string | null>(null);
    const call = useCall(groupId);
    const [micMuted, setMicMuted] = useState(false);
    const [deafened, setDeafened] = useState(false);

    const leave = useCallback(() => setGroupId(null), []);

    function toggleMic() {
        if (deafened) {
            setDeafened(false);
            setMicMuted(false);
            return;
        }
        setMicMuted((current) => !current);
    }

    function toggleDeafen() {
        setDeafened((current) => !current);
    }

    const effectiveMicMuted = micMuted || deafened;

    useEffect(() => {
        call.localStream?.getAudioTracks().forEach((track) => {
            track.enabled = !effectiveMicMuted;
        });
    }, [call.localStream, effectiveMicMuted]);

    useEffect(() => {
        if (!groupId) return;

        call.send({ type: "mute-state", muted: effectiveMicMuted, deafened });
    }, [groupId, effectiveMicMuted, call.status, call.peers]);

    return (
        <ActiveCallContext.Provider
            value={{
                groupId,
                status: call.status,
                peers: call.peers,
                localStream: call.localStream,
                remoteStreams: call.remoteStreams,
                join: setGroupId,
                leave,
                switchMicrophone: call.switchMicrophone,

                micMuted, deafened, toggleMic, toggleDeafen,
                peerMuted: call.peerMuted,
                peerSharing: call.peerSharing,

                screenStream: call.screenStream,
                remoteScreenStreams: call.remoteScreenStreams,
                startScreenShare: call.startScreenShare,
                stopScreenShare: call.stopScreenShare,
            }}
        >
            {children}
        </ActiveCallContext.Provider>
    );
}

export function useActiveCall() {
    const context = useContext(ActiveCallContext);

    if (!context) {
        throw new Error(
            "useActiveCall must be used inside an AuthProvider",
        );
    }

    return context;
}