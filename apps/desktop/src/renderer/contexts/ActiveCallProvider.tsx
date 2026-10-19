import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import type { Peer, ScreenQuality } from "@concorde/shared";
import { playSound } from "../audio/sounds";

import type { CallStatus } from "../hooks/CallSocket";
import { useCall } from "../hooks/useCall";
import { useSpeakingIndicators } from "../hooks/useSpeakingIndicators";

interface ActiveCallContextData {
    groupId: string | null;
    status: CallStatus;
    peers: Peer[];
    peerMuted: Record<string, { muted: boolean; deafened: boolean }>;
    peerSharing: Record<string, boolean>;
    watchingShareIds: Set<string>;
    watchShare: (peerId: string) => void;
    unwatchShare: (peerId: string) => void;
    localStream: MediaStream | null;
    remoteStreams: Record<string, MediaStream>;
    speakingMap: Record<string, boolean>;
    join: (groupId: string) => void;
    leave: () => void;
    switchMicrophone: (next: MediaStream) => void;

    micMuted: boolean;
    deafened: boolean;
    toggleMic: () => void;
    toggleDeafen: () => void;
    screenAudioMuted: boolean;
    toggleScreenAudioMute: () => void;

    screenStream: MediaStream | null;
    remoteScreenStreams: Record<string, MediaStream>;
    remoteScreenAudioStreams: Record<string, MediaStream>;
    startScreenShare: (sourceId?: string, quality?: ScreenQuality, includeAudio?: boolean, isWindow?: boolean) => Promise<void>;
    stopScreenShare: () => void;
}

const ActiveCallContext = createContext<ActiveCallContextData | undefined>(undefined);

export function ActiveCallProvider({ children }: { children: ReactNode }) {
    const [groupId, setGroupId] = useState<string | null>(null);
    const call = useCall(groupId);
    const [micMuted, setMicMuted] = useState(false);
    const [deafened, setDeafened] = useState(false);
    const [screenAudioMuted, setScreenAudioMuted] = useState(false);

    const leave = useCallback(() => setGroupId(null), []);
    const speakingMap = useSpeakingIndicators(call.localStream, call.remoteStreams);
    const prevGroupId = useRef<string | null>(null);

    useEffect(() => {
        const prev = prevGroupId.current;
        if (prev === groupId) return;
        prevGroupId.current = groupId;
        if (groupId && !prev) playSound("join");
        else if (!groupId && prev) playSound("leave");
    }, [groupId]);

    function toggleMic() {
        if (deafened) {
            setDeafened(false);
            setMicMuted(false);
            playSound("micUnmute");
            return;
        }
        const next = !micMuted;
        setMicMuted(next);
        playSound(next ? "micMute" : "micUnmute");
    }

    function toggleDeafen() {
        const next = !deafened;
        setDeafened(next);
        if (next) playSound("deafenOn");
    }

    function toggleScreenAudioMute() {
        setScreenAudioMuted((current) => !current);
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
                speakingMap,
                join: setGroupId,
                leave,
                switchMicrophone: call.switchMicrophone,

                micMuted, deafened, toggleMic, toggleDeafen,
                screenAudioMuted, toggleScreenAudioMute,
                peerMuted: call.peerMuted,
                peerSharing: call.peerSharing,
                watchingShareIds: call.watchingShareIds,
                watchShare: call.watchShare,
                unwatchShare: call.unwatchShare,

                screenStream: call.screenStream,
                remoteScreenStreams: call.remoteScreenStreams,
                remoteScreenAudioStreams: call.remoteScreenAudioStreams,
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