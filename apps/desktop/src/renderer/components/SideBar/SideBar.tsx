import { useEffect, useState } from "react";
import { Headphones, HeadphoneOff, House, Mic, MicOff, PanelLeftClose, PanelLeftOpen, PhoneIncoming, Settings, Users, Volume2 } from "lucide-react";

import IconBtn from "../../components/IconBtn/IconBtn";
import type { SectionType } from "../../pages/HomePage";
import type { GroupRole, UserStatus } from "@concorde/shared";
import VoiceList from "./VoiceList";
import { useActiveCall } from "../../contexts/ActiveCallProvider";
import { useAuth } from "../../contexts/AuthContext";
import { useUserSocketSend } from "../../contexts/UserSocketProvider";
import NavigationButton from "../NavigationButton/NavigationButton";
import SettingsModal from "../SettingsModal/SettingsModal";

import { STATUS_COLOR, STATUS_LABEL } from "../../utils/status";
import { useActiveCalls, type ActiveCallEntry } from "../../hooks/useActiveCalls";
import { useFriendsList } from "../../hooks/useFriendsList";
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
}

export default function SideBar({ section, setSection, sidebarOpen = true, onToggleSidebar, selectedGroupId, onSelectGroup, onJoinCall, onGoFriends }: SideBarProps) {
    const { micMuted, deafened, toggleMic, toggleDeafen } = useActiveCall();
    const { user } = useAuth();
    const { requests } = useIncomingRequests();
    const { groups, load: reloadGroups } = useGroupsList();
    const { friends } = useFriendsList();
    const { calls: activeCalls, voiceGroupIds } = useActiveCalls(groups, friends);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const send = useUserSocketSend();
    const [status, setStatus] = useState<UserStatus>("online");
    const [statusMenuOpen, setStatusMenuOpen] = useState(false);

    useEffect(() => {
        void reloadGroups();
    }, [section, reloadGroups]);
    const effectiveMicMuted = micMuted || deafened;
    return (
        <aside className={styles.aside}>

            <nav className={styles.nav}>
                <NavigationButton id="home" label="Inicio" icon={House} selected={section == "home"} handleClick={() => setSection("home")} />
                <NavigationButton
                    id="friends"
                    label="Amigos"
                    icon={Users}
                    selected={section == "friends"}
                    handleClick={onGoFriends ?? (() => setSection("friends"))}
                    badge={requests.length}
                />
                <span className={styles.divisor}></span>
                {groups.length > 0 && (
                    <div className={styles.guildRow}>
                        {groups.map((group) => (
                            <button
                                key={group.id}
                                type="button"
                                className={`${styles.guildBtn} ${selectedGroupId === group.id && section === "group" ? styles.guildSelected : ""}`}
                                title={group.name}
                                aria-label={`Abrir grupo ${group.name}`}
                                aria-current={selectedGroupId === group.id && section === "group" ? "page" : undefined}
                                onClick={() => onSelectGroup({ id: group.id, name: group.name, role: group.role })}
                            >
                                {group.name.trim().charAt(0).toUpperCase() || "?"}
                                {voiceGroupIds.has(group.id) && (
                                    <span className={styles.voiceBadge} title="Chamada ativa">
                                        <Volume2 size={10} />
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
                {groups.length > 0 && <span className={styles.divisor}></span>}
            </nav>

            <section className={styles.roomPanel}>
                {activeCalls.length > 0 ? (
                    <div className={styles.callsBlock}>
                        <h4 className={styles.voiceLabel}>Chamadas ativas</h4>
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
                    <p className={styles.roomEmpty}>Nenhuma sala ativa.</p>
                )}
            </section>

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
                                            setStatus(option);
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
                    {onToggleSidebar && (
                        <IconBtn
                            id="sidebar"
                            name={sidebarOpen ? "Ocultar barra lateral" : "Mostrar barra lateral"}
                            icon={sidebarOpen ? PanelLeftClose : PanelLeftOpen}
                            handleClick={onToggleSidebar}
                        />
                    )}
                    <IconBtn id="config" name="Configurações" icon={Settings} handleClick={() => setSettingsOpen(true)} />
                </div>
            </footer>
            {settingsOpen && (
                <SettingsModal onClose={() => setSettingsOpen(false)} />
            )}
        </aside>
    )
}