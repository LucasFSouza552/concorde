import { useCallback, useEffect, useRef, useState } from "react";

import type { CallInvite, Friend } from "@concorde/shared";
import { useActiveCall } from "../contexts/ActiveCallProvider";
import { useAuth } from "../contexts/AuthContext";
import { useUserSocketConnected, useUserSocketEvent, useUserSocketSend } from "../contexts/UserSocketProvider";

import { api } from "../api/api";

export const CALL_RING_TIMEOUT_MS = 30_000;

type OutgoingState =
    | { status: "idle" }
    | { status: "dialing"; callId: string; groupId: string; toUserId: string, toDisplayName: string }
    | { status: "dialing-group"; groupId: string; pending: { callId: string; userId: string; displayName: string }[] };

export function useCallInvite() {
    const [outgoing, setOutgoing] = useState<OutgoingState>({ status: "idle" });
    const [incoming, setIncoming] = useState<CallInvite | null>(null);
    const [waiting, setWaiting] = useState<CallInvite | null>(null);
    const { join, leave, groupId, peers } = useActiveCall();

    const [joinedGroup, setJoinedGroup] = useState<{ callGroupId: string; concordeGroupId: string } | null>(null);
    const { user } = useAuth();

    const lastEvent = useUserSocketEvent();
    const timeoutRef = useRef<number | null>(null);
    const announcedRef = useRef<{ groupId: string | null; concordeGroupId: string | null } | undefined>(undefined);
    const socketConnected = useUserSocketConnected();
    const sendUserMessage = useUserSocketSend();

    useEffect(() => {
        if (!socketConnected) {
            announcedRef.current = undefined;
            return;
        }
        const concordeGroupId = joinedGroup?.concordeGroupId ?? null;
        const current = announcedRef.current;
        if (current && current.groupId === groupId && current.concordeGroupId === concordeGroupId) return;
        announcedRef.current = { groupId, concordeGroupId };
        sendUserMessage({ type: "call-state", groupId, concordeGroupId });
    }, [groupId, joinedGroup, socketConnected, sendUserMessage]);

    function joinGroupCall(callGroupId: string, concordeGroupId: string | null) {
        join(callGroupId);
        setJoinedGroup(concordeGroupId ? { callGroupId, concordeGroupId } : null);
    }
    const recentPeerIds = useRef<Set<string>>(new Set());
    const peersRef = useRef(peers);
    peersRef.current = peers;

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

            if (peersRef.current.length === 0) {
                leave();
            }
            setOutgoing({ status: "idle" });
        }, CALL_RING_TIMEOUT_MS);
    }

    async function dialGroup(concordeGroupId: string, members: { id: string, displayName: string }[]) {
        if (outgoing.status !== "idle") return;
        if (!user) return;

        const others = members.filter((member) => member.id !== user.id);
        if (others.length === 0) return;

        const { data } = await api.post<{ groupId: string, invites: { callId: string; toUserId: string }[] }>("/calls/group", {
            toUserIds: others.map((member) => member.id),
            concordeGroupId
        });

        join(data.groupId);
        setJoinedGroup({ callGroupId: data.groupId, concordeGroupId });
        setOutgoing({
            status: "dialing-group",
            groupId: data.groupId,
            pending: data.invites.map((invite) => ({
                callId: invite.callId,
                userId: invite.toUserId,
                displayName: others.find((member) => member.id === invite.toUserId)?.displayName ?? "?",
            })),
        });

        timeoutRef.current = window.setTimeout(() => {
            if (peersRef.current.length === 0) {
                leave();
                setJoinedGroup((current) => (current?.callGroupId === data.groupId ? null : current));
            }
            setOutgoing({ status: "idle" });
        }, CALL_RING_TIMEOUT_MS);

    }

    useEffect(() => {
        if (!groupId) {
            recentPeerIds.current.clear();
            return;
        }

        peers.forEach((peer) => recentPeerIds.current.add(peer.userId));
    }, [groupId, peers]);

    useEffect(() => {
        if (!lastEvent) return;

        switch (lastEvent.type) {
            case "call-invite":
                if (groupId && recentPeerIds.current.has(lastEvent.invite.fromUserId)) {
                    void api.post(`/calls/${lastEvent.invite.callId}/redirect`, {
                        callerId: lastEvent.invite.fromUserId,
                        groupId,
                        concordeGroupId: joinedGroup?.concordeGroupId ?? null,
                    }).catch(() => { });
                    break;
                }

                if (!incoming) {
                    setIncoming(lastEvent.invite);
                } else if (!waiting || waiting.callId === lastEvent.invite.callId) {
                    setWaiting(lastEvent.invite);
                } else {
                    void api.post(`/calls/${lastEvent.invite.callId}/decline`, {
                        callerId: lastEvent.invite.fromUserId
                    }).catch(() => { });
                }
                break;
            case "call-accepted":
            case "call-declined": {
                clearTimer();
                if (outgoing.status === "dialing") {
                    if (lastEvent.type === "call-declined") {
                        if (outgoing.callId !== lastEvent.callId) break;
                        leave();
                    }
                    setOutgoing({ status: "idle" });
                } else if (outgoing.status === "dialing-group") {
                    const remaining = outgoing.pending.filter((item) => item.callId !== lastEvent.callId);
                    setOutgoing(remaining.length === 0 ? { status: "idle" } : { ...outgoing, pending: remaining });
                }
                break;
            }
            case "call-cancelled":
                if (incoming?.callId === lastEvent.callId) {
                    setIncoming(null);
                } else if (waiting?.callId === lastEvent.callId) {
                    setWaiting(null);
                }
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
                    setJoinedGroup(lastEvent.concordeGroupId ? { callGroupId: lastEvent.groupId, concordeGroupId: lastEvent.concordeGroupId } : null);
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

        leave();
        await api.post(`/calls/${incoming.callId}/accept`, {
            callerId: incoming.fromUserId
        });

        join(incoming.groupId);
        setJoinedGroup(incoming.concordeGroupId ? { callGroupId: incoming.groupId, concordeGroupId: incoming.concordeGroupId } : null);
        setIncoming(null);
    }

    async function cancelDial() {
        if (outgoing.status !== "dialing" && outgoing.status !== "dialing-group") return;

        clearTimer();

        if (outgoing.status === "dialing") {
            await api.post(`/calls/${outgoing.callId}/cancel`, {
                toUserId: outgoing.toUserId
            });
        } else {
            await Promise.all(outgoing.pending.map((item) =>
                api.post(`/calls/${item.callId}/cancel`, { toUserId: item.userId }).catch(() => { })
            ));
        }

        leave();
        setOutgoing({ status: "idle" });
        setJoinedGroup(null);
    }

    async function declineIncoming() {
        if (!incoming) return;

        await api.post(`/calls/${incoming.callId}/decline`, {
            callerId: incoming.fromUserId
        });

        setIncoming(null);
    }

    async function acceptWaiting() {
        if (!waiting) return;

        leave();
        await api.post(`/calls/${waiting.callId}/accept`, {
            callerId: waiting.fromUserId
        });

        join(waiting.groupId);
        setJoinedGroup(waiting.concordeGroupId ? { callGroupId: waiting.groupId, concordeGroupId: waiting.concordeGroupId } : null);
        setWaiting(null);
    }

    async function declineWaiting() {
        if (!waiting) return;

        await api.post(`/calls/${waiting.callId}/decline`, {
            callerId: waiting.fromUserId
        });

        setWaiting(null);
    }

    async function hangUp() {
        if (outgoing.status === "dialing" || outgoing.status === "dialing-group") {
            await cancelDial();
            return;
        }

        leave();
        setJoinedGroup(null);
    }

    useEffect(() => {
        return () => clearTimer();
    }, [clearTimer]);

    return { outgoing, incoming, waiting, dial, acceptIncoming, declineIncoming, acceptWaiting, declineWaiting, cancelDial, hangUp, joinedGroup, dialGroup, joinGroupCall };
}