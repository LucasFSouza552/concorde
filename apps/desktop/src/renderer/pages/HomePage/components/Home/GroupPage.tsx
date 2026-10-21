import { useEffect, useState } from "react";
import { Users } from "lucide-react";

import CallScreen from "../../../../components/CallScreen/CallScreen";
import Page from "../../../../components/Page/Page";
import type { GroupRole } from "@concorde/shared";
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
    const { dialGroup, joinedGroup, joinGroupCall } = useCallInviteState();
    const lastEvent = useUserSocketEvent();
    const [showMembers, setShowMembers] = useState(false);
    const [activeRoom, setActiveRoom] = useState<{ groupId: string; byName: string } | null>(null);

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
            const checks = await Promise.all(members.map(async (member) => {
                try {
                    const { data } = await api.get<{ inCall: boolean; groupId: string | null; concordeGroupId: string | null }>(`/user/${member.id}/presence`);
                    return { member, data };
                } catch {
                    return null;
                }
            }));

            if (cancelled) return;

            const found = checks.find(
                (check) => check && check.data.inCall && check.data.groupId && check.data.concordeGroupId === groupId
            );

            setActiveRoom(found && found.data.groupId
                ? { groupId: found.data.groupId, byName: found.member.displayName }
                : null);
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
                    <CallScreen layout="full" peerName={name} onBack={onBack} flat />
                    <button
                        type="button"
                        className={styles.membersFloatBtn}
                        aria-label={showMembers ? "Ocultar membros" : "Mostrar membros"}
                        aria-pressed={showMembers}
                        title={showMembers ? "Ocultar membros" : "Mostrar membros"}
                        onClick={toggleMembers}
                    >
                        <Users size={16} />
                    </button>
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
                    callAction={activeRoom ? "join" : "start"}
                    callLabel={activeRoom ? "Entrar na chamada" : "Iniciar chamada"}
                    onCall={() => {
                        if (activeRoom) joinGroupCall(activeRoom.groupId, groupId);
                        else void dialGroup(groupId, members);
                    }}
                />
            )}
        </Page>
    );
}