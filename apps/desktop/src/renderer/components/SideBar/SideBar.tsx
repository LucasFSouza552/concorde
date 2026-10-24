import { useEffect, useRef, useState } from "react";
import { Headphones, HeadphoneOff, Mic, MicOff, PanelLeftClose, PhoneIncoming, Plus, Search, Settings, Trash2, Users, Volume2, House } from "lucide-react";

import IconBtn from "../../components/IconBtn/IconBtn";
import type { SectionType } from "../../pages/HomePage";
import type { Friend, GroupRole } from "@concorde/shared";
import VoiceList from "./VoiceList";
import CreateGroupModal from "../../pages/HomePage/components/Home/CreateGroupModal";
import { useActiveCall } from "../../contexts/ActiveCallProvider";
import { useAuth } from "../../contexts/AuthContext";
import { useUserSocketSend } from "../../contexts/UserSocketProvider";
import SettingsModal from "../SettingsModal/SettingsModal";

import { STATUS_COLOR, STATUS_LABEL } from "../../utils/status";
import { setOwnStatus, useOwnStatus } from "../../utils/ownStatus";
import { useUserSocketEvent } from "../../contexts/UserSocketProvider";
import { api, getErrorMessage } from "../../api/api";
import { useToast } from "../../contexts/ToastProvider";
import { notifyGroupsChanged } from "../../hooks/useGroupsList";
import { useActiveCalls, type ActiveCallEntry } from "../../hooks/useActiveCalls";
import { useFriendsList } from "../../hooks/useFriendsList";
import { useFriendsPresence } from "../../hooks/useFriendsPresence";
import { useGroupsList } from "../../hooks/useGroupsList";
import { useIncomingRequests } from "../../hooks/useIncomingRequests";

import styles from "./SideBar.module.css";

const SETTABLE_STATUSES = ["online", "away", "busy", "invisible"] as const;

interface SideBarProps {
    section: SectionType;
    setSection: (section: SectionType) => void;
    sidebarOpen?: boolean;
    onToggleSidebar?: () => void;
    selectedGroupId: string | null;
    onSelectGroup: (group: { id: string; name: string; role: GroupRole }) => void;
    onJoinCall: (call: ActiveCallEntry) => void;
    onGoFriends?: () => void;
    onOpenFriend?: (friend: Friend) => void;
    onGroupDeleted?: (groupId: string) => void;
}

export default function SideBar({ section, setSection, sidebarOpen = true, onToggleSidebar, selectedGroupId, onSelectGroup, onJoinCall, onGoFriends, onOpenFriend, onGroupDeleted }: SideBarProps) {
    const { micMuted, deafened, toggleMic, toggleDeafen } = useActiveCall();
    const { user } = useAuth();
    const { requests } = useIncomingRequests();
    const { groups, load: reloadGroups } = useGroupsList();
    const { friends } = useFriendsList();
    const { calls: activeCalls, voiceGroupIds } = useActiveCalls(groups, friends);
    const presences = useFriendsPresence(friends);
    const { push } = useToast();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [groupMenu, setGroupMenu] = useState<{ x: number; y: number; group: { id: string; name: string; role: GroupRole } } | null>(null);
    const [menuArmed, setMenuArmed] = useState(false);
    const [deletingGroup, setDeletingGroup] = useState(false);
    const send = useUserSocketSend();
    const status = useOwnStatus();
    const [statusMenuOpen, setStatusMenuOpen] = useState(false);
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

    useEffect(() => {
        void reloadGroups();
    }, [section, reloadGroups]);

    const effectiveMicMuted = micMuted || deafened;
    const needle = query.trim().toLowerCase();
    const filteredFriends = needle
        ? friends.filter((f) => f.displayName.toLowerCase().includes(needle) || f.username.toLowerCase().includes(needle))
        : friends;

    function handleSelect(group: { id: string; name: string; role: GroupRole }) {
        onSelectGroup(group);
        setSection("group");
    }

    function closeGroupMenu() {
        setGroupMenu(null);
        setMenuArmed(false);
    }

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
            push(getErrorMessage(error), "error");
        } finally {
            setDeletingGroup(false);
        }
    }

    return (
        <aside className={styles.aside}>

            <nav className={styles.rail} aria-label="Navegação global">
                <button
                    type="button"
                    className={`${styles.railBtn} ${section === "home" ? styles.railSelected : ""}`}
                    title="Início"
                    aria-label="Início"
                    aria-current={section === "home" ? "page" : undefined}
                    onClick={() => setSection("home")}
                >
                    <House size={20} />
                </button>
                <button
                    type="button"
                    className={`${styles.railBtn} ${section === "friends" ? styles.railSelected : ""}`}
                    title="Amigos"
                    aria-label="Amigos"
                    aria-current={section === "friends" ? "page" : undefined}
                    onClick={onGoFriends ?? (() => setSection("friends"))}
                >
                    <Users size={20} />
                    {requests.length > 0 && (
                        <span className={styles.railBadge} aria-label={`${requests.length} pedidos pendentes`}>
                            {requests.length > 9 ? "9+" : requests.length}
                        </span>
                    )}
                </button>

                <span className={styles.railDivider} aria-hidden="true" />

                {groups.map((group) => (
                    <button
                        key={group.id}
                        type="button"
                        className={`${styles.railBtn} ${styles.railGuild} ${selectedGroupId === group.id && section === "group" ? styles.railSelected : ""}`}
                        title={group.name}
                        aria-label={`Abrir grupo ${group.name}`}
                        aria-current={selectedGroupId === group.id && section === "group" ? "page" : undefined}
                        onClick={() => handleSelect(group)}
                        onContextMenu={(event) => {
                            event.preventDefault();
                            setMenuArmed(false);
                            setGroupMenu({
                                x: Math.min(event.clientX, window.innerWidth - 200),
                                y: Math.min(event.clientY, window.innerHeight - 130),
                                group,
                            });
                        }}
                    >
                        {group.name.trim().charAt(0).toUpperCase() || "?"}
                        {voiceGroupIds.has(group.id) && (
                            <span className={styles.railPip} title="Chamada ativa">
                                <Volume2 size={10} />
                            </span>
                        )}
                    </button>
                ))}

                <span className={styles.railSpacer} aria-hidden="true" />

                <button
                    type="button"
                    className={`${styles.railBtn} ${styles.railAdd}`}
                    title="Criar grupo"
                    aria-label="Criar grupo"
                    onClick={() => setCreateOpen(true)}
                >
                    <Plus size={20} />
                </button>
            </nav>

            <section className={styles.panel} aria-label="Navegação local">
                <div className={styles.searchRow}>
                    <Search size={14} aria-hidden="true" className={styles.searchIcon} />
                    <input
                        type="text"
                        className={styles.searchField}
                        value={query}
                        placeholder="Buscar conversas"
                        aria-label="Buscar conversas"
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    {onToggleSidebar && (
                        <button
                            type="button"
                            className={styles.searchAction}
                            title={sidebarOpen ? "Ocultar barra lateral" : "Mostrar barra lateral"}
                            aria-label={sidebarOpen ? "Ocultar barra lateral" : "Mostrar barra lateral"}
                            onClick={onToggleSidebar}
                        >
                            <PanelLeftClose size={16} />
                        </button>
                    )}
                </div>

                <div className={styles.panelScroll}>
                    <h4 className={styles.categoryLabel}>Chamadas ativas</h4>
                    {activeCalls.length > 0 ? (
                        <div className={styles.callsBlock}>
                            {activeCalls.map((call) => (
                                <div key={call.key} className={styles.callGroup}>
                                    <button
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
                                    {call.isCurrent && (
                                        <div className={styles.callVoices}>
                                            <VoiceList />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className={styles.roomEmpty}>Nenhuma chamada ativa agora.</p>
                    )}

                    <span className={styles.panelDivider} aria-hidden="true" />

                    <h4 className={styles.categoryLabel}>Conversas</h4>
                    {filteredFriends.length > 0 ? (
                        <ul className={styles.dmList}>
                            {filteredFriends.map((friend) => (
                                <li key={friend.id}>
                                    <button
                                        type="button"
                                        className={styles.dmRow}
                                        title={`Conversar com ${friend.displayName}`}
                                        onClick={() => onOpenFriend ? onOpenFriend(friend) : onGoFriends?.()}
                                    >
                                        <span className={styles.dmAvatar}>
                                            {friend.displayName.trim().charAt(0).toUpperCase()}
                                            <span
                                                className={styles.dmStatusDot}
                                                style={{ background: STATUS_COLOR[presences.get(friend.id)?.status ?? "offline"] }}
                                                title={presences.get(friend.id)?.status ?? "offline"}
                                            />
                                        </span>
                                        <span className={styles.dmText}>
                                            <span className={styles.dmName}>{friend.displayName}</span>
                                            <span className={styles.dmSub}>@{friend.username}</span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className={styles.roomEmpty}>{needle ? "Nada encontrado." : "Adicione amigos para conversar."}</p>
                    )}
                </div>

                <footer className={styles.userPanel}>
                    <div className={styles.avatarWrap}>
                        <div className={styles.avatar}>{(user?.displayName ?? "?").trim().charAt(0).toUpperCase()}</div>

                        <button
                            type="button"
                            className={styles.statusDot}
                            style={{ background: STATUS_COLOR[status] }}
                            title={`Status: ${STATUS_LABEL[status]}`}
                            aria-label={`Alterar status (atual: ${STATUS_LABEL[status]})`}
                            aria-expanded={statusMenuOpen}
                            onClick={() => setStatusMenuOpen((open) => !open)}
                        />

                        {statusMenuOpen && (
                            <>
                                <div className={styles.statusBackdrop} onClick={() => setStatusMenuOpen(false)} />
                                <div className={styles.statusMenu} role="menu">
                                    {SETTABLE_STATUSES.map((option) => (
                                        <button
                                            key={option}
                                            type="button"
                                            role="menuitemradio"
                                            aria-checked={status === option}
                                            className={`${styles.statusItem} ${status === option ? styles.statusItemSelected : ""}`}
                                            onClick={() => {
                                                setOwnStatus(option);
                                                setStatusMenuOpen(false);
                                                send({ type: "set-status", status: option });
                                            }}
                                        >
                                            <span className={styles.statusDotStatic} style={{ background: STATUS_COLOR[option] }} />
                                            {STATUS_LABEL[option]}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    <div className={styles.identity}>
                        <span className={styles.username}>{user?.displayName}</span>
                        <span className={styles.userHandle}>@{user?.username}</span>
                    </div>
                    <div className={styles.actions}>
                        <IconBtn
                            id="mute"
                            name={effectiveMicMuted ? "Desmutar" : "Silenciar"}
                            icon={effectiveMicMuted ? MicOff : Mic}
                            handleClick={toggleMic}
                            active={effectiveMicMuted}
                            tone="danger"
                        />
                        <IconBtn
                            id="muteAudio"
                            name={deafened ? "Ativar áudio" : "Desativar áudio"}
                            icon={deafened ? HeadphoneOff : Headphones}
                            handleClick={toggleDeafen}
                            active={deafened}
                            tone="danger"
                        />
                        <IconBtn id="config" name="Configurações" icon={Settings} handleClick={() => setSettingsOpen(true)} />
                    </div>
                </footer>
            </section>

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
                            onClick={() => { handleSelect(groupMenu.group); closeGroupMenu(); }}
                        >
                            Abrir grupo
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

            {settingsOpen && (
                <SettingsModal onClose={() => setSettingsOpen(false)} />
            )}
            {createOpen && (
                <CreateGroupModal onClose={() => setCreateOpen(false)} onCreated={() => void reloadGroups()} />
            )}
        </aside>
    )
}
