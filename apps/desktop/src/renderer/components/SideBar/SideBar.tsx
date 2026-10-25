import { useEffect, useRef, useState } from "react";
import { MessageCircle, MoreVertical, Phone, PhoneIncoming, Plus, Search, Trash2, UserPlus, UsersRound, Volume2 } from "lucide-react";

import type { Friend, GroupRole } from "@concorde/shared";
import AddFriendModal from "../../pages/HomePage/components/Home/AddFriendModal";
import CreateGroupModal from "../../pages/HomePage/components/Home/CreateGroupModal";
import IncomingRequestsList from "../../pages/HomePage/components/Friends/IncomingRequestsList";
import { useCallInviteState } from "../../contexts/CallInviteProvider";
import { useUserSocketEvent } from "../../contexts/UserSocketProvider";
import { api, getErrorMessage } from "../../api/api";
import { useToast } from "../../contexts/ToastProvider";
import { notifyGroupsChanged } from "../../hooks/useGroupsList";
import { useActiveCalls, type ActiveCallEntry } from "../../hooks/useActiveCalls";
import { useFriendsList } from "../../hooks/useFriendsList";
import { useFriendsPresence } from "../../hooks/useFriendsPresence";
import { useGroupsList } from "../../hooks/useGroupsList";
import { useIncomingRequests } from "../../hooks/useIncomingRequests";
import { STATUS_COLOR } from "../../utils/status";

import styles from "./SideBar.module.css";

type PanelTab = "friends" | "groups" | "pending";

interface SideBarProps {
    /** Amigo com conversa aberta no centro, para destaque na lista. */
    activeFriendId: string | null;
    onOpenFriend: (friend: Friend) => void;
    onOpenGroup: (group: { id: string; name: string; role: GroupRole }) => void;
    onJoinCall: (call: ActiveCallEntry) => void;
    onGroupDeleted?: (groupId: string) => void;
}

export default function SideBar({ activeFriendId, onOpenFriend, onOpenGroup, onJoinCall, onGroupDeleted }: SideBarProps) {
    const { requests, accept, decline, loadRequests, loading: loadingRequests, error: errorRequests } = useIncomingRequests();
    const { groups, load: reloadGroups } = useGroupsList();
    const { friends, load: reloadFriends } = useFriendsList();
    const { calls: activeCalls } = useActiveCalls(groups, friends);
    const presences = useFriendsPresence(friends);
    const { dial } = useCallInviteState();
    const { push } = useToast();
    const [tab, setTab] = useState<PanelTab>("friends");
    const [createOpen, setCreateOpen] = useState(false);
    const [addOpen, setAddOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [groupMenu, setGroupMenu] = useState<{ x: number; y: number; group: { id: string; name: string; role: GroupRole } } | null>(null);
    const [menuArmed, setMenuArmed] = useState(false);
    const [deletingGroup, setDeletingGroup] = useState(false);
    const lastEvent = useUserSocketEvent();
    const kickedHandledRef = useRef<typeof lastEvent>(null);

    useEffect(() => {
        if (!lastEvent) return;
        if (lastEvent.type !== "group-kicked") return;
        // `lastEvent` persiste até o próximo evento: dedupe por identidade
        // para não repetir o toast quando as deps do efeito mudam.
        if (kickedHandledRef.current === lastEvent) return;
        kickedHandledRef.current = lastEvent;

        const { groupId, groupName, reason } = lastEvent;

        const message = reason === "removed"
            ? `Você foi removido de ${groupName}.`
            : reason === "dissolved"
                ? `O grupo ${groupName} foi dissolvido.`
                : `Você saiu de ${groupName}.`;

        push(message, "info");
        void reloadGroups();
        onGroupDeleted?.(groupId);
    }, [lastEvent, push, reloadGroups, onGroupDeleted]);

    const needle = query.trim().toLowerCase();
    // fora do JSX: dentro do ramo "else" do ternário TS estreita variáveis nulas.
    const filteredFriends = needle
        ? friends.filter((f) => f.displayName.toLowerCase().includes(needle) || f.username.toLowerCase().includes(needle))
        : friends;
    const filteredGroups = needle
        ? groups.filter((g) => g.name.toLowerCase().includes(needle))
        : groups;

    function openGroup(group: { id: string; name: string; role: GroupRole }) {
        onOpenGroup(group);
    }

    function closeGroupMenu() {
        setGroupMenu(null);
        setMenuArmed(false);
    }

    // Escape fecha o menu de contexto do grupo.
    useEffect(() => {
        if (!groupMenu) return;
        function handleKey(event: KeyboardEvent) {
            if (event.key !== "Escape") return;
            closeGroupMenu();
        }
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [groupMenu]);

    async function deleteGroup(group: { id: string; name: string; role: GroupRole }) {
        if (deletingGroup) return;
        setDeletingGroup(true);

        try {
            await api.delete(`/groups/${group.id}`);
            notifyGroupsChanged();
            push(`${group.name} foi apagado.`, "info");
            onGroupDeleted?.(group.id);
            closeGroupMenu();
            void reloadGroups();
        } catch (error) {
            // Desarma o menu, mantendo-o aberto para nova tentativa consciente.
            setMenuArmed(false);
            push(getErrorMessage(error), "error");
        } finally {
            setDeletingGroup(false);
        }
    }

const TABS: { id: PanelTab; label: string }[] = [
    { id: "friends", label: "Amigos" },
    { id: "groups", label: "Grupos" },
    { id: "pending", label: "Pendentes" },
];

const ROLE_LABEL: Record<GroupRole, string> = {
    owner: "Líder",
    admin: "Admin",
    member: "Membro",
};

    return (
        <aside className={styles.aside} aria-label="Painel de conversas">
            <div className={styles.searchRow}>
                <Search size={14} aria-hidden="true" className={styles.searchIcon} />
                <input
                    type="text"
                    className={styles.searchField}
                    value={query}
                    placeholder="Buscar amigos"
                    aria-label="Buscar amigos"
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>

            <>
                <nav className={styles.segmentRow} role="tablist" aria-label="Alternar painel">
                        {TABS.map((entry) => (
                            <button
                                key={entry.id}
                                type="button"
                                role="tab"
                                aria-selected={tab === entry.id}
                                className={`${styles.segmentBtn} ${tab === entry.id ? styles.segmentBtnActive : ""}`}
                                onClick={() => setTab(entry.id)}
                            >
                                {entry.label}
                                {entry.id === "pending" && requests.length > 0 && (
                                    <span className={styles.segmentBadge}>{requests.length}</span>
                                )}
                            </button>
                        ))}
                        <button
                            type="button"
                            className={styles.segmentAddBtn}
                            title="Adicionar amigo"
                            aria-label="Adicionar amigo"
                            onClick={() => setAddOpen(true)}
                        >
                            <UserPlus size={15} />
                        </button>
                    </nav>

                    <div className={styles.panelScroll}>
                        {tab === "friends" && (
                            filteredFriends.length > 0 ? (
                                <ul className={styles.dmList}>
                                    {filteredFriends.map((friend) => {
                                        const presence = presences.get(friend.id);
                                        const chatActive = activeFriendId === friend.id;
                                        const friendInCall = Boolean(presence?.inCall);
                                        return (
                                            <li key={friend.id}>
                                                <div className={`${styles.dmRow} ${chatActive ? styles.dmRowActive : ""}`.trim()}>
                                                    <button
                                                        type="button"
                                                        className={styles.dmMain}
                                                        title={`Conversar com ${friend.displayName}`}
                                                        onClick={() => onOpenFriend(friend)}
                                                    >
                                                        <span className={styles.dmAvatar}>
                                                            {friend.displayName.trim().charAt(0).toUpperCase()}
                                                            <span
                                                                className={styles.dmStatusDot}
                                                                style={{ background: STATUS_COLOR[presence?.status ?? "offline"] }}
                                                                title={presence?.status ?? "offline"}
                                                            />
                                                        </span>
                                                        <span className={styles.dmText}>
                                                            <span className={styles.dmName}>{friend.displayName}</span>
                                                            <span
                                                                className={presences.get(friend.id)?.customMessage ? styles.dmSubMsg : styles.dmSub}
                                                                title={presences.get(friend.id)?.customMessage ?? `@${friend.username}`}
                                                            >
                                                                {presences.get(friend.id)?.customMessage || `@${friend.username}`}
                                                            </span>
                                                        </span>
                                                        {friendInCall && (
                                                            <span className={styles.dmLiveBadge} title="Em chamada agora">
                                                                <Phone size={12} aria-hidden="true" />
                                                            </span>
                                                        )}
                                                    </button>
                                                    <span className={styles.rowActions}>
                                                        <button
                                                            type="button"
                                                            className={styles.rowActionBtn}
                                                            title={`Ligar para ${friend.displayName}`}
                                                            aria-label={`Ligar para ${friend.displayName}`}
                                                            onClick={() => void dial(friend)}
                                                        >
                                                            <Phone size={15} aria-hidden="true" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={styles.rowActionBtn}
                                                            title={`Mensagem para ${friend.displayName}`}
                                                            aria-label={`Mensagem para ${friend.displayName}`}
                                                            onClick={() => onOpenFriend(friend)}
                                                        >
                                                            <MessageCircle size={15} aria-hidden="true" />
                                                        </button>
                                                    </span>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <p className={styles.roomEmpty}>{needle ? "Nada encontrado." : "Adicione amigos para conversar."}</p>
                            )
                        )}

                        {tab === "groups" && (
                            <>
                                {activeCalls.length > 0 && (
                                    <>
                                        <h4 className={styles.categoryLabel}>Chamadas ativas</h4>
                                        <div className={styles.callsBlock}>
                                            {activeCalls.map((call) => (
                                                <button
                                                    key={call.key}
                                                    type="button"
                                                    className={`${styles.callRow} ${call.isCurrent ? styles.callRowCurrent : ""}`}
                                                    title={call.isCurrent ? `Ir para ${call.title}` : `Entrar em ${call.title}`}
                                                    onClick={() => onJoinCall(call)}
                                                >
                                                    <span className={styles.callAvatar}>
                                                        {call.title.trim().charAt(0).toUpperCase() || "?"}
                                                    </span>
                                                    <span className={styles.callText}>
                                                        <span className={styles.callTitle}>{call.title}</span>
                                                        <span className={styles.callSub}>{call.subtitle}</span>
                                                    </span>
                                                    {call.isCurrent
                                                        ? <Volume2 size={16} className={styles.callLiveIcon} aria-hidden="true" />
                                                        : <PhoneIncoming size={16} className={styles.callJoinIcon} aria-hidden="true" />}
                                                </button>
                                            ))}
                                        </div>
                                        <span className={styles.panelDivider} aria-hidden="true" />
                                    </>
                                )}

                                {filteredGroups.length > 0 ? (
                                    <ul className={styles.dmList}>
                                        {filteredGroups.map((group) => {
                                            const groupInCall = activeCalls.some((call) => call.group?.id === group.id);
                                            return (
                                                <li key={group.id}>
                                                <div className={styles.dmRow}>
                                                    <button
                                                        type="button"
                                                        className={styles.dmMain}
                                                        title={`Abrir grupo ${group.name}`}
                                                        onClick={() => openGroup(group)}
                                                    >
                                                        <span className={styles.groupAvatar} aria-hidden="true">
                                                            <UsersRound size={14} />
                                                        </span>
                                                        <span className={styles.dmText}>
                                                            <span className={styles.dmName}>{group.name}</span>
                                                            <span className={styles.dmSub}>
                                                                {group.memberCount === 1 ? "1 membro" : `${group.memberCount} membros`} · {ROLE_LABEL[group.role]}
                                                            </span>
                                                        </span>
                                                        {groupInCall && (
                                                            <span className={styles.dmLiveBadge} title="Chamada em andamento no grupo">
                                                                <Phone size={12} aria-hidden="true" />
                                                            </span>
                                                        )}
                                                    </button>
                                                    <span className={styles.rowActions}>
                                                        <button
                                                            type="button"
                                                            className={styles.rowActionBtn}
                                                            title={`Opções do grupo ${group.name}`}
                                                            aria-label={`Opções do grupo ${group.name}`}
                                                            onClick={(event) => {
                                                                const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                                                setMenuArmed(false);
                                                                setGroupMenu({
                                                                    x: Math.min(rect.left, window.innerWidth - 200),
                                                                    y: Math.min(rect.bottom + 4, window.innerHeight - 130),
                                                                    group,
                                                                });
                                                            }}
                                                        >
                                                            <MoreVertical size={15} aria-hidden="true" />
                                                        </button>
                                                    </span>
                                                </div>
                                                </li>
                                                );
                                            })}
                                        </ul>
                                ) : (
                                    <p className={styles.roomEmpty}>{needle ? "Nada encontrado." : "Crie um grupo para conversar em equipe."}</p>
                                )}

                                <button
                                    type="button"
                                    className={styles.createGroupBtn}
                                    onClick={() => setCreateOpen(true)}
                                >
                                    <Plus size={16} aria-hidden="true" />
                                    Criar grupo
                                </button>
                            </>
                        )}

                        {tab === "pending" && (
                            <IncomingRequestsList
                                requests={requests}
                                loading={loadingRequests}
                                error={errorRequests}
                                onAccept={async (friendId: string) => {
                                    await accept(friendId);
                                    reloadFriends();
                                }}
                                onDecline={(friendId: string) => decline(friendId)}
                                onReload={() => void loadRequests()}
                            />
                        )}
                    </div>
                </>

            {groupMenu && (
                <>
                    <div className={styles.menuBackdrop} onPointerDown={closeGroupMenu} onContextMenu={(event) => { event.preventDefault(); closeGroupMenu(); }} />
                    <div
                        className={styles.groupMenu}
                        role="menu"
                        style={{ left: groupMenu.x, top: groupMenu.y }}
                    >
                        <button
                            type="button"
                            role="menuitem"
                            className={styles.menuItem}
                            onClick={() => { openGroup(groupMenu.group); closeGroupMenu(); }}
                        >
                            <UsersRound size={14} /> Abrir grupo
                        </button>
                        {groupMenu.group.role === "owner" && (
                            <button
                                type="button"
                                role="menuitem"
                                disabled={deletingGroup}
                                className={`${styles.menuItemDanger} ${menuArmed ? styles.menuItemArmed : ""}`}
                                onClick={() => {
                                    if (!menuArmed) { setMenuArmed(true); return; }
                                    void deleteGroup(groupMenu.group);
                                }}
                            >
                                <Trash2 size={14} />
                                {menuArmed ? "Confirmar exclusão?" : "Apagar grupo"}
                            </button>
                        )}
                    </div>
                </>
            )}

            {addOpen && <AddFriendModal onClose={() => setAddOpen(false)} />}
            {createOpen && (
                <CreateGroupModal onClose={() => setCreateOpen(false)} onCreated={() => void reloadGroups()} />
            )}
        </aside>
    );
}
