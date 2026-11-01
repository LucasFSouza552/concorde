import { useEffect, useState } from "react";

import CallScreen from "../../../../components/CallScreen/CallScreen";
import Page from "../../../../components/Page/Page";
import type { GroupRole, PresenceBatchResponse } from "@concorde/shared";
import GroupDetail from "./GroupDetail";
import { useCallInviteState } from "../../../../contexts/CallInviteProvider";
import { useUserSocketEvent } from "../../../../contexts/UserSocketProvider";

import { api } from "../../../../api/api";
import { useGroupMembers } from "../../../../hooks/useGroupMembers";

import styles from "./Home.module.css";

interface GroupPageProps {
    groupId: string;
    name: string;
    role: GroupRole;
    onBack: () => void;
}

export default function GroupPage({ groupId, name, role, onBack }: GroupPageProps) {
    const { members } = useGroupMembers(groupId);
    const { joinGroupCall, joinedGroup } = useCallInviteState();
    const lastEvent = useUserSocketEvent();
    const [showMembers, setShowMembers] = useState(false);
    const [activeRoom, setActiveRoom] = useState<{ groupId: string; byName: string; participants: { id: string; displayName: string }[] } | null>(null);

    const inGroupCall = joinedGroup?.concordeGroupId === groupId;
    const toggleMembers = () => setShowMembers((visible) => !visible);
    const [presenceTick, setPresenceTick] = useState(0);

    useEffect(() => {
        if (inGroupCall) {
            setActiveRoom(null);
            return;
        }

        let cancelled = false;

        void (async () => {
            // 1 batch (1 request) em vez de 1 GET por membro.
            if (members.length === 0) {
                setActiveRoom(null);
                return;
            }
            try {
                const { data } = await api.post<PresenceBatchResponse>("/user/presence/batch", {
                    ids: members.map((member) => member.id),
                });
                if (cancelled) return;

                let roomGroupId: string | null = null;
                let roomByName: string | null = null;

                for (const member of members) {
                    const presence = data.presences[member.id];
                    if (presence?.inCall && presence.groupId && presence.concordeGroupId === groupId) {
                        roomGroupId = presence.groupId;
                        roomByName = member.displayName;
                        break;
                    }
                }

                // Participantes presentes: quem está na MESMA sala ativa do grupo.
                const participants = roomGroupId
                    ? members
                        .filter((member) => data.presences[member.id]?.groupId === roomGroupId)
                        .map((member) => ({ id: member.id, displayName: member.displayName }))
                    : [];

                setActiveRoom(roomGroupId
                    ? { groupId: roomGroupId, byName: roomByName ?? "alguém", participants }
                    : null);
            } catch {
                // Falhou: mantém o estado anterior até o próximo tick/evento.
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [groupId, members, inGroupCall, presenceTick]);

    useEffect(() => {
        if (!lastEvent || lastEvent.type !== "peer-call-state") return;
        if (inGroupCall) return;
        if (!members.some((member) => member.id === lastEvent.userId)) return;
        setPresenceTick((tick) => tick + 1);
    }, [lastEvent, members, inGroupCall]);

    return (
        <Page flush={inGroupCall}>
            {inGroupCall ? (
                <div className={styles.callWithMembers}>
                    <CallScreen layout="full" peerName={name} onBack={onBack} flat showMembers={showMembers} onToggleMembers={toggleMembers} />
                    
                    {showMembers && (
                        <div className={styles.membersPanel}>
                            <GroupDetail
                                groupId={groupId}
                                name={name}
                                myRole={role}
                                onBack={onBack}
                                membersVisible
                                onToggleMembers={toggleMembers}
                            />
                        </div>
                    )}
                </div>
            ) : (
                <GroupDetail
                    groupId={groupId}
                    name={name}
                    myRole={role}
                    onBack={onBack}
                    callParticipants={activeRoom?.participants}
                    callAction={activeRoom ? "join" : "start"}
                    callLabel={activeRoom ? "Entrar na chamada" : "Iniciar chamada"}
                    onCall={() => {
                        if (activeRoom) joinGroupCall(activeRoom.groupId, groupId);
                        else joinGroupCall(`group:${groupId}`, groupId);
                    }}
                />
            )}
        </Page>
    );
}