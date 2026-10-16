import { useEffect, useState } from "react";
import { Headphones, HeadphoneOff, House, Mic, MicOff, PanelLeftClose, PanelLeftOpen, Settings, Users, Volume2 } from "lucide-react";

import type { GroupRole } from "@concorde/shared";

import IconBtn from "../../components/IconBtn/IconBtn";
import type { SectionType } from "../../pages/HomePage";
import { useActiveCall } from "../../contexts/ActiveCallProvider";
import { useAuth } from "../../contexts/AuthContext";
import NavigationButton from "../NavigationButton/NavigationButton";
import SettingsModal from "../SettingsModal/SettingsModal";
import VoiceList from "./VoiceList";
import { useIncomingRequests } from "../../hooks/useIncomingRequests";
import { useGroupsList } from "../../hooks/useGroupsList";
import { useGroupsVoice } from "../../hooks/useGroupsVoice";

import styles from "./SideBar.module.css";

interface SideBarProps {
    section: SectionType;
    setSection: (section: SectionType) => void;
    sidebarOpen?: boolean;
    onToggleSidebar?: () => void;
    selectedGroupId: string | null;
    onSelectGroup: (group: { id: string; name: string; role: GroupRole }) => void;
}

export default function SideBar({ section, setSection, sidebarOpen = true, onToggleSidebar, selectedGroupId, onSelectGroup }: SideBarProps) {
    const { groupId, micMuted, deafened, toggleMic, toggleDeafen } = useActiveCall();
    const { user } = useAuth();
    const { requests } = useIncomingRequests();
    const { groups, load: reloadGroups } = useGroupsList();
    const voiceGroups = useGroupsVoice(groups);
    const [settingsOpen, setSettingsOpen] = useState(false);

    useEffect(() => {
        void reloadGroups();
    }, [section, reloadGroups]);
    const effectiveMicMuted = micMuted || deafened;
    return (
        <aside className={styles.aside}>

            <nav className={styles.nav}>
                <NavigationButton id="home" label="Inicio" icon={House} selected={section == "home"} handleClick={() => setSection("home")} />
                <NavigationButton id="friends" label="Amigos" icon={Users} selected={section == "friends"} handleClick={() => setSection("friends")} badge={requests.length} />
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
                                {voiceGroups.has(group.id) && (
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
                <h4 className={styles.roomTitle}>Minhas Salas</h4>

                {groupId ? (
                    <>
                        <h4 className={styles.voiceLabel}>Chamada</h4>
                        <div
                            className={styles.voiceSlot}
                            onClick={() => setSection("friends")}
                            title="Voltar para a chamada"
                        >
                            <VoiceList />
                        </div>
                    </>
                ) : (
                    <p className={styles.roomEmpty}>Nenhuma sala ativa.</p>
                )}

            </section>

            <footer className={styles.userPanel}>
                <div className={styles.avatar}>{(user?.displayName ?? "?").trim().charAt(0).toUpperCase()}</div>
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