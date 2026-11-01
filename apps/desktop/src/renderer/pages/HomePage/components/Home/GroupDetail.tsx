import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Crown, LogOut, MoreVertical, Phone, PhoneIncoming, Plus, RefreshCw, Search, Shield, User, UserPlus, Users, Volume2 } from "lucide-react";

import ProfilePanel from "../../../../components/ProfilePanel/ProfilePanel";
import { SkeletonList } from "../../../../components/Skeleton/Skeleton";
import UserAvatar from "../../../../components/UserAvatar/UserAvatar";
import { roleLabels, type Friend, type GroupRole, type PresenceBatchResponse } from "@concorde/shared";
import { useAuth } from "../../../../contexts/AuthContext";
import { useToast } from "../../../../contexts/ToastProvider";
import { useUserSocketEvent } from "../../../../contexts/UserSocketProvider";

import { api, getErrorMessage } from "../../../../api/api";
import { useFriendsList } from "../../../../hooks/useFriendsList";
import { useGroupMembers, invalidateGroupMembers, type GroupMemberItem } from "../../../../hooks/useGroupMembers";
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
    /** Presentes na chamada ativa do grupo (card com avatares + entrar). */
    callParticipants?: { id: string; displayName: string }[];
}

function roleIcon(role: string) {
    if (role === "owner") return <Crown size={12} aria-hidden="true" />;
    if (role === "admin") return <Shield size={12} aria-hidden="true" />;
    return <User size={12} aria-hidden="true" />;
}

export default function GroupDetail({ groupId, name, myRole, onBack, membersVisible, onToggleMembers, callAction = null, callLabel, onCall, callParticipants }: GroupDetailProps) {
    const { members, loading, error, load } = useGroupMembers(groupId);
    const { friends, load: loadFriends } = useFriendsList();
    const { user } = useAuth();
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
    // Menu de contexto (botão direito) sobre um membro: perfil / adicionar amigo.
    const [memberMenu, setMemberMenu] = useState<{ x: number; y: number; member: GroupMemberItem } | null>(null);
        const [profile, setProfile] = useState<GroupMemberItem | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const openItemRef = useRef<HTMLDivElement | null>(null);
    const lastEvent = useUserSocketEvent();
    const { push } = useToast();
    const canManage = myRole === "owner" || myRole === "admin";

    const friendIds = new Set(friends.map((friend) => friend.id));

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
                    if (presence.status && presence.status !== "offline") online.add(member.id);
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

    // Escape fecha o menu de contexto e o cartão de perfil.
    useEffect(() => {
        if (!memberMenu && !profile) return;
        function handleKey(event: KeyboardEvent) {
            if (event.key !== "Escape") return;
            setMemberMenu(null);
            setProfile(null);
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [memberMenu, profile]);

    useEffect(() => {
        if (addOpen && friends.length === 0) void loadFriends();
    }, [addOpen, friends.length, loadFriends]);

    // Amizades precisam estar carregadas para o menu de contexto (botão direito)
    // saber a quem oferecer "Adicionar amigo".
    useEffect(() => {
        if (friends.length === 0) void loadFriends();
    }, [friends.length, loadFriends]);    useEffect(() => {
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
            invalidateGroupMembers(groupId);
            await load(true);
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
            invalidateGroupMembers(groupId);
            await load(true);
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

    async function sendFriendRequest(member: GroupMemberItem) {
        setMemberMenu(null);

        try {
            await api.post("/friends/requests", { username: member.username });
            push(`Pedido enviado para @${member.username}.`, "success");
        } catch (error) {
            push(getErrorMessage(error), "error");
        }
    }

    function openMemberMenu(event: React.MouseEvent, member: GroupMemberItem) {
        event.preventDefault();
        setMemberMenu({
            x: Math.min(event.clientX, window.innerWidth - 210),
            y: Math.min(event.clientY, window.innerHeight - 120),
            member,
        });
    }

    async function handleRole(userId: string, role: GroupRole) {
        setOpenMenu(null);
        setPendingRemove(null);
        try {
            await api.patch(`/groups/${groupId}/members/${userId}`, {
                role: role === "admin" ? "member" : "admin",
            });
            invalidateGroupMembers(groupId);
            await load(true);
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
                    {callAction && (callAction === "start" || !callParticipants?.length) && (
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

            {callAction === "join" && !!callParticipants?.length && (
                <div className={styles.roomCard}>
                    <div className={styles.roomAvatars} aria-hidden="true">
                        {callParticipants.slice(0, 4).map((participant) => (
                            <span key={participant.id} className={styles.roomAvatar}>
                                {participant.displayName.trim().charAt(0).toUpperCase() || "?"}
                            </span>
                        ))}
                        {callParticipants.length > 4 && (
                            <span className={`${styles.roomAvatar} ${styles.roomAvatarMore}`}>
                                +{callParticipants.length - 4}
                            </span>
                        )}
                    </div>
                    <div className={styles.roomInfo}>
                        <span className={styles.roomTitle}>
                            {callParticipants.length > 1 ? `${callParticipants.length} na chamada` : "1 na chamada"}
                        </span>
                        <span className={styles.roomSub}>Chamada em andamento</span>
                    </div>
                    <button type="button" className={styles.roomJoinBtn} onClick={onCall}>
                        <PhoneIncoming size={14} aria-hidden="true" />
                        Entrar
                    </button>
                </div>
            )}

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
                                            <UserAvatar name={friend.displayName} avatar={friend.avatar} size={30} />
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
                                        <div className={styles.gMemberRow} onContextMenu={(event) => openMemberMenu(event, member)}>
                                            <span className={styles.gMemberAvatarWrap}>
                                                <UserAvatar name={member.displayName} avatar={member.avatar} size={30} />
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

            {/* Menu de contexto (botão direito) em membros do grupo */}
            {memberMenu && (() => {
                const isSelf = memberMenu.member.id === user?.id;
                const isFriend = friendIds.has(memberMenu.member.id);
                return (
                    <>
                        <div
                            className={styles.menuBackdropFixed}
                            onPointerDown={() => setMemberMenu(null)}
                            onContextMenu={(event) => { event.preventDefault(); setMemberMenu(null); }}
                        />
                        <div className={styles.gMemberContextMenu} role="menu" style={{ left: memberMenu.x, top: memberMenu.y }}>
                            <button
                                type="button"
                                role="menuitem"
                                className={styles.gMenuItem}
                                onClick={() => { setProfile(memberMenu.member); setMemberMenu(null); }}
                            >
                                <User size={14} aria-hidden="true" />
                                Ver perfil
                            </button>
                            {!isSelf && !isFriend && (
                                <button
                                    type="button"
                                    role="menuitem"
                                    className={styles.gMenuItem}
                                    onClick={() => void sendFriendRequest(memberMenu.member)}
                                >
                                    <UserPlus size={14} aria-hidden="true" />
                                    Adicionar amigo
                                </button>
                            )}
                        </div>
                    </>
                );
            })()}

            {/* Painel de perfil (lateral esquerda) de qualquer pessoa do grupo */}
            {profile && (() => {
                const isSelf = profile.id === user?.id;
                const isFriend = friendIds.has(profile.id);
                return (
                    <ProfilePanel
                        key={profile.id}
                        user={profile}
                        onClose={() => setProfile(null)}
                        roleLabel={roleLabels[profile.role as GroupRole] ?? profile.role}
                        actions={!isSelf && !isFriend ? (
                            <button
                                type="button"
                                className={styles.joinBtn}
                                onClick={() => void sendFriendRequest(profile)}
                            >
                                <UserPlus size={14} aria-hidden="true" />
                                Adicionar amigo
                            </button>
                        ) : undefined}
                    />
                );
            })()}
        </div>
    );
}