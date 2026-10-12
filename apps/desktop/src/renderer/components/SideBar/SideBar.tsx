import { useState } from "react";
import { Headphones, HeadphoneOff, House, Mic, MicOff, Settings, Users } from "lucide-react";

import IconBtn from "../../components/IconBtn/IconBtn";
import type { SectionType } from "../../pages/HomePage";
import { useActiveCall } from "../../contexts/ActiveCallProvider";
import { useAuth } from "../../contexts/AuthContext";
import NavigationButton from "../NavigationButton/NavigationButton";
import SettingsModal from "../SettingsModal/SettingsModal";
import VoiceList from "./VoiceList";

import styles from "./SideBar.module.css";

interface SideBarProps {
    section: SectionType;
    setSection: (section: SectionType) => void;
}

export default function SideBar({ section, setSection }: SideBarProps) {
    const { groupId, micMuted, deafened, toggleMic, toggleDeafen } = useActiveCall();
    const { user } = useAuth();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const effectiveMicMuted = micMuted || deafened;
    return (
        <aside className={styles.aside}>

            <nav className={styles.nav}>
                <NavigationButton id="home" label="Inicio" icon={House} selected={section == "home"} handleClick={() => setSection("home")} />
                <NavigationButton id="friends" label="Amigos" icon={Users} selected={section == "friends"} handleClick={() => setSection("friends")} />
                <span className={styles.divisor}></span>
            </nav>

            <section className={styles.roomPanel}>
                <h4>Minhas Salas</h4>

                {groupId && (
                    <>
                        <h4 className={styles.voiceLabel}>Chamada</h4>
                        <div
                            className={styles.voiceSlot}
                            onClick={() => setSection("room")}
                            title="Voltar para a chamada"
                        >
                            <VoiceList />
                        </div>
                    </>
                )}

            </section>

            <footer className={styles.userPanel}>
                <div className={styles.avatar}>{user?.username[0]}</div>
                <span className={styles.username}>{user?.username}</span>
                <div className={styles.actions}>
                    <IconBtn
                        id="mute"
                        name={effectiveMicMuted ? "Desmutar" : "Silenciar"}
                        icon={effectiveMicMuted ? MicOff : Mic}
                        handleClick={toggleMic}
                    />
                    <IconBtn
                        id="muteAudio"
                        name={deafened ? "Ativar áudio" : "Desativar áudio"}
                        icon={deafened ? HeadphoneOff : Headphones}
                        handleClick={toggleDeafen}
                    />
                    <IconBtn id="config" name="Configurações" icon={Settings} handleClick={() => setSettingsOpen(true)} />
                </div>
            </footer>
            {settingsOpen && (
                <SettingsModal onClose={() => setSettingsOpen(false)} />
            )}
        </aside>
    )
}