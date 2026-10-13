import { useCallback, useEffect, useRef, useState } from "react";

import type { CallInvite, Friend } from "@concorde/shared";
import { useActiveCall } from "../contexts/ActiveCallProvider";
import { useUserSocketEvent } from "../contexts/UserSocketProvider";

import { api } from "../api/api";

export const CALL_RING_TIMEOUT_MS = 30_000;

type OutgoingState =
    | { status: "idle" }
    | { status: "dialing"; callId: string; groupId: string; toUserId: string, toDisplayName: string };

export function useCallInvite() {
    const [outgoing, setOutgoing] = useState<OutgoingState>({ status: "idle" });
    const [incoming, setIncoming] = useState<CallInvite | null>(null);
    const { join, leave, groupId, peers } = useActiveCall();

    const lastEvent = useUserSocketEvent();
    const timeoutRef = useRef<number | null>(null);

    const clearTimer = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    async function dial(friend: Friend) {
        if (outgoing.status !== "idle") return;

        if (groupId && peers.some((peer) => peer.userId === friend.id)) return;

        const { data } = await api.post<{ invite: CallInvite }>("/calls", { toUserId: friend.id });

        join(data.invite.groupId);
        setOutgoing({
            status: "dialing",
            groupId: data.invite.groupId,
            callId: data.invite.callId,
            toUserId: friend.id,
            toDisplayName: friend.displayName
        });

        timeoutRef.current = window.setTimeout(() => {
            void api.post(`/calls/${data.invite.callId}/cancel`, {
                toUserId: friend.id
            });

            leave();
            setOutgoing({ status: "idle" });
        }, CALL_RING_TIMEOUT_MS);
    }

    useEffect(() => {
        if (!lastEvent) return;

        switch (lastEvent.type) {
            case "call-invite":
                if (groupId) {
                    void api.post(`/calls/${lastEvent.invite.callId}/redirect`, {
                        callerId: lastEvent.invite.fromUserId,
                        groupId,
                    }).catch(() => { });
                    break;
                }

                setIncoming(lastEvent.invite);
                break;
            case "call-accepted":
            case "call-declined":
                clearTimer();
                if (lastEvent.type === "call-declined") leave();
                if (outgoing.status !== "idle") {
                    setOutgoing({ status: "idle" });
                }

                break;
            case "call-cancelled":
                setIncoming(null);
                break;
            case "call-redirect":
                if (outgoing.status === "dialing" && outgoing.callId === lastEvent.callId) {
                    clearTimer();
                    void api.post(`/calls/${outgoing.callId}/cancel`, {
                        toUserId: outgoing.toUserId
                    }).catch(() => { });
                    leave();
                    setOutgoing({ status: "idle" });
                    join(lastEvent.groupId);
                }
                break;
        }
    }, [lastEvent, leave, clearTimer]);

    async function acceptIncoming() {
        if (!incoming) return;

        if (outgoing.status === "dialing") {
            clearTimer();
            await api.post(`/calls/${outgoing.callId}/cancel`, {
                toUserId: outgoing.toUserId
            });
            leave();
            setOutgoing({ status: "idle" });
        }

        await api.post(`/calls/${incoming.callId}/accept`, {
            callerId: incoming.fromUserId
        });

        join(incoming.groupId);
        setIncoming(null);
    }

    async function cancelDial() {
        if (outgoing.status !== "dialing") return;

        clearTimer();

        await api.post(`/calls/${outgoing.callId}/cancel`, {
            toUserId: outgoing.toUserId
        });

        leave();
        setOutgoing({ status: "idle" });
    }

    async function declineIncoming() {
        if (!incoming) return;

        await api.post(`/calls/${incoming.callId}/decline`, {
            callerId: incoming.fromUserId
        });

        setIncoming(null);
    }

    async function hangUp() {
        if (outgoing.status === "dialing") {
            await cancelDial();
            return;
        }

        leave();
    }

    useEffect(() => {
        return () => clearTimer();
    }, [clearTimer]);

    return { outgoing, incoming, dial, acceptIncoming, declineIncoming, cancelDial, hangUp };
}