import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Crown, LogOut, MoreVertical, Phone, PhoneIncoming, Plus, RefreshCw, Search, Shield, User, UserPlus, Users, Volume2 } from "lucide-react";

import { roleLabels, type Friend, type GroupRole, type PresenceBatchResponse } from "@concorde/shared";
import { useToast } from "../../../../contexts/ToastProvider";
import { useUserSocketEvent } from "../../../../contexts/UserSocketProvider";

import { api, getErrorMessage } from "../../../../api/api";
import { SkeletonList } from "../../../../components/Skeleton/Skeleton";
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
    /** Chamada no cabeçalho: null = ocultar; "start" = abrir chamada; "join" = entrar na ativa */
    callAction?: "start" | "join" | null;
    callLabel?: string;
    onCall?: () => void;
}

function roleIcon(role: string) {
    if (role === "owner") return <Crown size={12} aria-hidden="true" />;
    if (role === "admin") return <Shield size={12} aria-hidden="true" />;
    return <User size={12} aria-hidden="true" />;
}

export default function GroupDetail({ groupId, name, myRole, onBack, membersVisible, onToggleMembers, callAction = null, callLabel, onCall }: GroupDetailProps) {
    const { members, loading, error, load } = useGroupMembers(groupId);
    const { friends, load: loadFriends } = useFriendsList();
    const [search, setSearch] = useState("");
    const [addOpen, setAddOpen] = useState(false);
    const [addQuery, setAddQuery] = useState("");
    const [internalVisible, setInternalVisible] = useState(true);
    const [presenceTick, setPresenceTick] = useState(0);
    const [inCallIds, setInCallIds] = useState<Set<string>>(new Set());
    const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
    const [pendingAction, setPendingAction] = useState<"leave" | "dissolve" | null>(null);
    const [optionBusy, setOptionBusy] = useState(false);
    const [openMenu, setOpenMenu] = useState<"header" | string | null>(null);
    const [pendingRemove, setPendingRemove] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const openItemRef = useRef<HTMLDivElement | null>(null);
    const lastEvent = useUserSocketEvent();
    const { push } = useToast();
    const canManage = myRole === "owner" || myRole === "admin";

    const showMembers = membersVisible ?? internalVisible;
    const toggleMembers = onToggleMembers ?? (() => setInternalVisible((visible) => !visible));

    const needle = search.trim().toLowerCase();
    const visibleMembers = needle
        ? members.filter((member) => member.displayName.toLowerCase().includes(needle) || member.username.toLowerCase().includes(needle))
        : members;

    const memberIds = new Set(members.map((member) => member.id));
    const addNeedle = addQuery.trim().toLowerCase();
    const suggestions = friends
        .filter((friend) => !memberIds.has(friend.id))
        .filter((friend) =>
            !addNeedle
            || friend.displayName.toLowerCase().includes(addNeedle)
            || friend.username.toLowerCase().includes(addNeedle)
        );

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            // 1 batch (1 request) em vez de 1 GET por membro.
            if (members.length === 0) {
                setInCallIds(new Set());
                return;
            }
            try {
                const { data } = await api.post<PresenceBatchResponse>("/user/presence/batch", {
                    ids: members.map((member) => member.id),
                });
                if (cancelled) return;
                const inCall = new Set<string>();
                const online = new Set<string>();
                members.forEach((member) => {
                    const presence = data.presences[member.id];
                    if (!presence) return;
                    if (presence?.inCall && presence.concordeGroupId === groupId) inCall.add(member.id);
                    if (presence.status && presence.status !== "offline" && presence.status !== "invisible") online.add(member.id);
                });
                setInCallIds(inCall);
                setOnlineIds(online);
            } catch {
                // Falhou: mantém o estado anterior até o próximo tick/evento.
            }
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

    // Fechar o menu desarma a exclusão pendente (2 cliques): ver callbacks.
    // Escape fecha o menu aberto de ações.
    useEffect(() => {
        if (openMenu === null) return;
        function handleKey(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setOpenMenu(null);
                setPendingRemove(null);
            }
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [openMenu]);

    useEffect(() => {
        if (addOpen && friends.length === 0) void loadFriends();
    }, [addOpen, friends.length, loadFriends]);

    useEffect(() => {
        function onPointerDown(event: PointerEvent) {
            const target = event.target as Node;
            const insideMenu = menuRef.current?.contains(target) || openItemRef.current?.contains(target);
            if (openMenu !== null && !insideMenu) {
                setOpenMenu(null);
                setPendingRemove(null);
            }
        }

        window.addEventListener("pointerdown", onPointerDown);
        return () => window.removeEventListener("pointerdown", onPointerDown);
    }, [openMenu]);

    async function addFriend(friend: Friend) {
        try {
            await api.post(`/groups/${groupId}/members`, { username: friend.username });
            setAddQuery("");
            await load();
            push(`${friend.displayName} adicionado ao grupo.`, "success");
        } catch (error) {
            push(getErrorMessage(error), "error");
        }
    }

    async function handleRemove(userId: string, displayName: string) {
        setOpenMenu(null);
        setPendingRemove(null);
        try {
            await api.delete(`/groups/${groupId}/members/${userId}`);
            await load();
            push(`${displayName} removido do grupo.`, "info");
        } catch (error) {
            push(getErrorMessage(error), "error");
        }
    }

    function requestRemove(member: { id: string; displayName: string }) {
        if (pendingRemove !== member.id) {
            setPendingRemove(member.id);
            return;
        }
        void handleRemove(member.id, member.displayName);
    }

    async function handleRole(userId: string, role: GroupRole) {
        setOpenMenu(null);
        setPendingRemove(null);
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

    return (
        <div className={styles.detail} style={membersVisible ? { height: "100%" } : undefined}>
            <header className={styles.gHeader}>
                <div className={styles.gHeaderMain}>
                    <button type="button" className={styles.backBtn} aria-label="Voltar para grupos" onClick={onBack}>
                        <ArrowLeft size={18} />
                    </button>
                    <span className={styles.detailAvatar} aria-hidden="true">
                        {name.trim().charAt(0).toUpperCase() || "?"}
                    </span>
                    <div className={styles.listText}>
                        <span className={styles.listName}>{name}</span>
                        <span className={styles.listSub}>
                            Membros: {members.length}
                        </span>
                        <span className={styles.gHeaderDesc}>
                            Convide amigos, converse por voz e gerencie o grupo.
                        </span>
                    </div>
                </div>

                <div className={styles.gHeaderActions}>
                    {callAction && (
                        <button type="button" className={styles.gCallBtn} onClick={onCall}>
                            {callAction === "start" ? <Phone size={14} /> : <PhoneIncoming size={14} />}
                            {callLabel ?? (callAction === "start" ? "Iniciar chamada" : "Entrar na chamada")}
                        </button>
                    )}
                    <div className={styles.gMoreWrap} ref={menuRef}>
                        <button
                            type="button"
                            className={styles.gMoreBtn}
                            aria-label="Opções do grupo"
                            aria-expanded={openMenu === "header"}
                            onClick={() => setOpenMenu(openMenu === "header" ? null : "header")}
                        >
                            <MoreVertical size={16} />
                        </button>
                        {openMenu === "header" && (
                            <div className={styles.gMenu} role="menu">
                                <button
                                    type="button"
                                    role="menuitem"
                                    className={styles.gMenuItem}
                                    onClick={() => { setOpenMenu(null); setPendingRemove(null); void load(); }}
                                >
                                    <RefreshCw size={14} />
                                    Atualizar membros
                                </button>
                                {members.length > 0 && (showMembers
                                    ? (
                                        <button type="button" role="menuitem" className={styles.gMenuItem} onClick={() => { setOpenMenu(null); setPendingRemove(null); toggleMembers(); }}>
                                            <Users size={14} />
                                            Ocultar membros
                                        </button>
                                    )
                                    : (
                                        <button type="button" role="menuitem" className={styles.gMenuItem} onClick={() => { setOpenMenu(null); setPendingRemove(null); toggleMembers(); }}>
                                            <Users size={14} />
                                            Mostrar membros
                                        </button>
                                    ))}
                                {myRole !== "owner" && (
                                    <button
                                        type="button"
                                        role="menuitem"
                                        disabled={optionBusy}
                                        className={`${styles.gMenuItem} ${styles.gMenuItemDanger}`}
                                        onClick={() => { setOpenMenu(null); setPendingRemove(null); void performLeave(); }}
                                    >
                                        <LogOut size={14} />
                                        {pendingAction === "leave" ? "Confirmar saída?" : "Sair do grupo"}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {showMembers && (
                <div className={styles.gBody}>
                    <div className={styles.gToolbar}>
                        <div className={styles.gSearchWrap}>
                                <Search size={14} aria-hidden="true" className={styles.gSearchIcon} />
                                <input
                                    className={styles.gSearchField}
                                    placeholder="Pesquisar membros do grupo..."
                                    value={search}
                                    aria-label="Pesquisar membros"
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Escape") {
                                            setSearch("");
                                            event.currentTarget.blur();
                                        }
                                    }}
                                />
                            </div>
                        {canManage && addOpen ? (
                            <div className={styles.gAddWrap}>
                                <Plus size={14} aria-hidden="true" className={styles.gSearchIcon} />
                                <input
                                    className={styles.gSearchField}
                                    placeholder="Buscar amigos por nome ou @tag"
                                    value={addQuery}
                                    autoFocus
                                    aria-label="Buscar amigos para adicionar"
                                    onChange={(e) => setAddQuery(e.target.value)}
                                    onBlur={() => { if (!addQuery) setAddOpen(false); }}
                                    onKeyDown={(event) => {
                                        if (event.key === "Escape") {
                                            setAddQuery("");
                                            setAddOpen(false);
                                            event.currentTarget.blur();
                                        }
                                        if (event.key === "Enter" && suggestions[0]) void addFriend(suggestions[0]);
                                    }}
                                />
                                <div className={styles.gAddMenu} role="list">
                                    {suggestions.length === 0 && (
                                        <p className={styles.gAddEmpty}>
                                            {friends.length === 0 ? "Nenhum amigo para adicionar." : "Nenhum amigo encontrado."}
                                        </p>
                                    )}
                                    {suggestions.slice(0, 8).map((friend) => (
                                        <button
                                            key={friend.id}
                                            type="button"
                                            role="listitem"
                                            className={styles.gAddRow}
                                            title={`Adicionar ${friend.displayName}`}
                                            onMouseDown={() => void addFriend(friend)}
                                        >
                                            <span className={styles.listAvatar} aria-hidden="true">
                                                {friend.displayName.trim().charAt(0).toUpperCase() || "?"}
                                            </span>
                                            <div className={styles.listText}>
                                                <span className={styles.listName}>{friend.displayName}</span>
                                                <span className={styles.listSub}>@{friend.username}</span>
                                            </div>
                                            <Plus size={14} className={styles.gAddRowIcon} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            canManage && (
                                <button
                                    type="button"
                                    className={styles.gInviteBtn}
                                    aria-label="Convidar membros"
                                    title="Convidar membros"
                                    onClick={() => setAddOpen(true)}
                                >
                                    <UserPlus size={15} />
                                    Convidar membros
                                </button>
                            )
                        )}
                    </div>

                    <div className={styles.gColumns}>
                        <section className={styles.gMembersCol} aria-label="Membros">
                            {loading && <SkeletonList rows={4} rowHeight={44} />}
                            {error && <p className={styles.empty}>{error}</p>}
                            {!loading && !error && visibleMembers.length === 0 && (
                                <p className={styles.empty}>{needle ? "Nenhum membro encontrado." : "Nenhum membro."}</p>
                            )}
                            {visibleMembers.length > 0 && (() => {
                                const renderMember = (member: (typeof members)[number]) => (
                                    <div
                                        key={member.id}
                                        className={styles.gMemberItem}
                                        ref={openMenu === member.id ? openItemRef : undefined}
                                    >
                                        <div className={styles.gMemberRow}>
                                            <span className={styles.gMemberAvatarWrap}>
                                                <span className={styles.listAvatar} aria-hidden="true">
                                                    {member.displayName.trim().charAt(0).toUpperCase() || "?"}
                                                </span>
                                                <span
                                                    className={inCallIds.has(member.id) ? styles.gStatusDotOnline : onlineIds.has(member.id) ? styles.gStatusDotIdle : styles.gStatusDotOffline}
                                                    title={inCallIds.has(member.id) ? "Em chamada" : onlineIds.has(member.id) ? "Online" : "Offline"}
                                                />
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
                                            <span className={`${styles.roleBadge} ${member.role === "owner" ? styles.roleBadgeOwner : member.role === "admin" ? styles.roleBadgeAdmin : styles.roleBadgeMember}`}>
                                                {roleIcon(member.role)}
                                                {roleLabels[member.role as GroupRole] ?? member.role}
                                            </span>
                                            {canManage && member.role !== "owner" && (
                                                <div className={styles.gRowMenuWrap}>
                                                    <button
                                                        type="button"
                                                        className={styles.gMoreBtn}
                                                        aria-label={`Ações para ${member.displayName}`}
                                                        aria-expanded={openMenu === member.id}
                                                        onClick={() => setOpenMenu(openMenu === member.id ? null : member.id)}
                                                    >
                                                        <MoreVertical size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {openMenu === member.id && canManage && member.role !== "owner" && (
                                            <div className={styles.gMemberActions} role="toolbar" aria-label={`Ações para ${member.displayName}`}>
                                                <button
                                                    type="button"
                                                    className={styles.gActionBtn}
                                                    onClick={() => { setOpenMenu(null); setPendingRemove(null); void handleRole(member.id, member.role as GroupRole); }}
                                                >
                                                    {member.role === "admin" ? "Rebaixar" : "Promover"}
                                                </button>
                                                <span className={styles.gActionDivider} aria-hidden="true" />
                                                <button
                                                    type="button"
                                                    className={`${styles.gActionBtn} ${styles.gActionBtnDanger}`}
                                                    onClick={() => { requestRemove(member); }}
                                                >
                                                    {pendingRemove === member.id ? "Confirmar?" : "Remover"}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );

                                const onlineMembers = visibleMembers.filter((member) => onlineIds.has(member.id) || inCallIds.has(member.id));
                                const offlineMembers = visibleMembers.filter((member) => !onlineMembers.includes(member));

                                return (
                                    <>
                                        <h4 className={styles.gSectionLabel}>Membros on-line ({onlineMembers.length})</h4>
                                        {onlineMembers.map(renderMember)}
                                        <h4 className={styles.gSectionLabel}>Membros off-line ({offlineMembers.length})</h4>
                                        {offlineMembers.map(renderMember)}
                                    </>
                                );
                            })()}
                        </section>
                    </div>
                </div>
            )}
        </div>
    );
}
