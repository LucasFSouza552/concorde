import { useEffect, useState } from "react";
import { ArrowLeft, Crown, LogOut, Plus, Shield, Trash2, User, Users, Volume2, X } from "lucide-react";

import { roleLabels, type Friend, type GroupRole } from "@concorde/shared";
import { useToast } from "../../../../contexts/ToastProvider";
import { useUserSocketEvent } from "../../../../contexts/UserSocketProvider";

import { api, getErrorMessage } from "../../../../api/api";
import { useFriendsList } from "../../../../hooks/useFriendsList";
import { useGroupMembers } from "../../../../hooks/useGroupMembers";
import { notifyGroupsChanged } from "../../../../hooks/useGroupsList";

import styles from "./Home.module.css";

interface GroupDetailProps {
    groupId: string;
    name: string;
    myRole: GroupRole;
    onBack: () => void;
    membersVisible?: boolean;
    onToggleMembers?: () => void;
}

function roleIcon(role: string) {
    if (role === "owner") return <Crown size={12} aria-hidden="true" />;
    if (role === "admin") return <Shield size={12} aria-hidden="true" />;
    return <User size={12} aria-hidden="true" />;
}

export default function GroupDetail({ groupId, name, myRole, onBack, membersVisible, onToggleMembers }: GroupDetailProps) {
    const { members, loading, error, load } = useGroupMembers(groupId);
    const { friends, load: loadFriends } = useFriendsList();
    const [username, setUsername] = useState("");
    const [inputFocused, setInputFocused] = useState(false);
    const [internalVisible, setInternalVisible] = useState(true);
    const [presenceTick, setPresenceTick] = useState(0);
    const [inCallIds, setInCallIds] = useState<Set<string>>(new Set());
    const [pendingAction, setPendingAction] = useState<"leave" | "dissolve" | null>(null);
    const [optionBusy, setOptionBusy] = useState(false);
    const lastEvent = useUserSocketEvent();
    const { push } = useToast();
    const canManage = myRole === "owner" || myRole === "admin";

    const showMembers = membersVisible ?? internalVisible;
    const toggleMembers = onToggleMembers ?? (() => setInternalVisible((visible) => !visible));

    const memberIds = new Set(members.map((member) => member.id));
    const query = username.trim().toLowerCase();
    const suggestions = friends
        .filter((friend) => !memberIds.has(friend.id))
        .filter((friend) =>
            !query
            || friend.displayName.toLowerCase().includes(query)
            || friend.username.toLowerCase().includes(query)
        );

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            const checks = await Promise.all(members.map(async (member) => {
                try {
                    const { data } = await api.get<{ inCall: boolean; concordeGroupId: string | null }>(`/user/${member.id}/presence`);
                    return data.inCall && data.concordeGroupId === groupId ? member.id : null;
                } catch {
                    return null;
                }
            }));

            if (cancelled) return;
            setInCallIds(new Set(checks.filter((id): id is string => id !== null)));
        })();

        return () => {
            cancelled = true;
        };
    }, [groupId, members, presenceTick]);

    useEffect(() => {
        if (!lastEvent || lastEvent.type !== "peer-call-state") return;
        if (!members.some((member) => member.id === lastEvent.userId)) return;
        setPresenceTick((tick) => tick + 1);
    }, [lastEvent, members]);

    async function handleAdd() {
        if (!username.trim()) return;
        try {
            await api.post(`/groups/${groupId}/members`, { username: username.trim() });
            setUsername("");
            await load();
            push("Membro adicionado.", "success");
        } catch (error) {
            push(getErrorMessage(error), "error");
        }
    }

    async function addFriend(friend: Friend) {
        try {
            await api.post(`/groups/${groupId}/members`, { username: friend.username });
            setUsername("");
            await load();
            push(`${friend.displayName} adicionado ao grupo.`, "success");
        } catch (error) {
            push(getErrorMessage(error), "error");
        }
    }

    async function handleRemove(userId: string, displayName: string) {
        try {
            await api.delete(`/groups/${groupId}/members/${userId}`);
            await load();
            push(`${displayName} removido do grupo.`, "info");
        } catch (error) {
            push(getErrorMessage(error), "error");
        }
    }

    async function handleRole(userId: string, role: GroupRole) {
        try {
            await api.patch(`/groups/${groupId}/members/${userId}`, {
                role: role === "admin" ? "member" : "admin",
            });
            await load();
        } catch (error) {
            push(getErrorMessage(error), "error");
        }
    }

    async function performLeave() {
        if (optionBusy) return;

        if (pendingAction !== "leave") {
            setPendingAction("leave");
            return;
        }

        setOptionBusy(true);

        try {
            await api.post(`/groups/${groupId}/leave`);
            notifyGroupsChanged();
            push(`Você saiu de ${name}.`, "info");
            onBack();
        } catch (error) {
            push(getErrorMessage(error), "error");
        } finally {
            setOptionBusy(false);
            setPendingAction(null);
        }
    }

    async function performDissolve() {
        if (optionBusy) return;

        if (pendingAction !== "dissolve") {
            setPendingAction("dissolve");
            return;
        }

        setOptionBusy(true);

        try {
            await api.delete(`/groups/${groupId}`);
            notifyGroupsChanged();
            push(`${name} foi dissolvido.`, "info");
            onBack();
        } catch (error) {
            push(getErrorMessage(error), "error");
        } finally {
            setOptionBusy(false);
            setPendingAction(null);
        }
    }

    return (
        <div className={styles.detail}>
            <div className={styles.detailHeader}>
                <button type="button" className={styles.backBtn} aria-label="Voltar para grupos" onClick={onBack}>
                    <ArrowLeft size={18} />
                </button>
                <span className={styles.detailAvatar} aria-hidden="true">
                    {name.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <div className={styles.listText}>
                    <span className={styles.listName}>{name}</span>
                    <span className={styles.listSub}>
                        {members.length} {members.length === 1 ? "membro" : "membros"}
                    </span>
                </div>
                <span className={styles.roleBadge}>{roleLabels[myRole] ?? myRole}</span>
                <button
                    type="button"
                    className={styles.miniBtn}
                    aria-label={showMembers ? "Ocultar membros" : "Mostrar membros"}
                    aria-pressed={showMembers}
                    title={showMembers ? "Ocultar membros" : "Mostrar membros"}
                    onClick={toggleMembers}
                >
                    <Users size={14} />
                </button>
            </div>

            {showMembers && (
                <>
                    {canManage && (
                        <div className={`${styles.joinRow} ${styles.memberAddRow}`}>
                            <input
                                className={styles.joinField}
                                placeholder="Digite para filtrar seus amigos"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                onFocus={async () => { setInputFocused(true); if (friends.length === 0) await loadFriends(); }}
                                onBlur={() => setInputFocused(false)}
                                onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
                            />
                            <button className={styles.joinBtn} onClick={() => void handleAdd()}>
                                <Plus size={14} /> Adicionar
                            </button>

                            {inputFocused && (
                                <div className={styles.memberSuggest}>
                                    {suggestions.length === 0 && (
                                        <p className={styles.suggestEmpty}>
                                            {friends.length === 0 ? "Nenhum amigo para adicionar." : "Nenhum amigo encontrado."}
                                        </p>
                                    )}
                                    {suggestions.slice(0, 50).map((friend) => (
                                        <button
                                            key={friend.id}
                                            type="button"
                                            className={styles.suggestRow}
                                            onMouseDown={() => void addFriend(friend)}
                                        >
                                            <span className={styles.listAvatar} aria-hidden="true">
                                                {friend.displayName.trim().charAt(0).toUpperCase() || "?"}
                                            </span>
                                            <div className={styles.listText}>
                                                <span className={styles.listName}>{friend.displayName}</span>
                                                <span className={styles.listSub}>@{friend.username}</span>
                                            </div>
                                            <Plus size={14} className={styles.suggestAdd} />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {loading && <p className={styles.empty}>Carregando membros...</p>}
                    {error && <p className={styles.empty}>{error}</p>}
                    {members.map((member) => (
                <div key={member.id} className={styles.memberRow}>
                    <span className={styles.listAvatar} aria-hidden="true">
                        {member.displayName.trim().charAt(0).toUpperCase() || "?"}
                    </span>
                    <div className={styles.listText}>
                        <span className={styles.listName}>{member.displayName}</span>
                        <span className={styles.listSub}>@{member.username}</span>
                    </div>
                    {inCallIds.has(member.id) && (
                        <span className={styles.voiceOn} title="Em chamada">
                            <Volume2 size={14} />
                        </span>
                    )}
                    <span className={styles.roleBadge}>
                        {roleIcon(member.role)}
                        {roleLabels[member.role as GroupRole] ?? member.role}
                    </span>
                    {canManage && member.role !== "owner" && (
                        <>
                            <button
                                type="button"
                                className={styles.miniBtn}
                                title={member.role === "admin" ? "Rebaixar para membro" : "Promover a admin"}
                                aria-label={`${member.role === "admin" ? "Rebaixar" : "Promover"} ${member.displayName}`}
                                onClick={() => void handleRole(member.id, member.role as GroupRole)}
                            >
                                {member.role === "admin" ? <User size={14} /> : <Shield size={14} />}
                            </button>
                            <button
                                type="button"
                                className={`${styles.miniBtn} ${styles.miniDanger}`}
                                aria-label={`Remover ${member.displayName}`}
                                onClick={() => void handleRemove(member.id, member.displayName)}
                            >
                                <X size={14} />
                            </button>
                        </>
                    )}
                </div>
             ))}
                </>
            )}

            <div className={styles.detailOptions}>
                {myRole !== "owner" && (
                    <button
                        type="button"
                        className={`${styles.optionDanger} ${pendingAction === "leave" ? styles.optionArmed : ""}`}
                        disabled={optionBusy}
                        onClick={() => void performLeave()}
                    >
                        <LogOut size={14} />
                        {pendingAction === "leave" ? "Confirmar saída?" : "Sair do grupo"}
                    </button>
                )}
                {myRole === "owner" && (
                    <button
                        type="button"
                        className={`${styles.optionDanger} ${pendingAction === "dissolve" ? styles.optionArmed : ""}`}
                        disabled={optionBusy}
                        onClick={() => void performDissolve()}
                    >
                        <Trash2 size={14} />
                        {pendingAction === "dissolve" ? "Confirmar? Apaga canais e mensagens." : "Dissolver grupo"}
                    </button>
                )}
            </div>
        </div>
    );
}
