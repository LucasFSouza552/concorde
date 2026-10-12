import { useEffect, useState } from "react";
import { Mic, SlidersHorizontal, User, X } from "lucide-react";

import AccountSettings from "./AccountSettings";
import AppPreferences from "./AppPreferences";
import AudioSettings from "./AudioSettings";

import styles from "./SettingsModal.module.css";

type SettingsTab = "account" | "audio" | "preferences";

const settingsTabs = {
    account: AccountSettings,
    audio: AudioSettings,
    preferences: AppPreferences,
};

export default function SettingsModal({ onClose }: { onClose: () => void }) {
    const [tab, setTab] = useState<SettingsTab>("account");

    useEffect(() => {
        function handleKey(event: KeyboardEvent) {
            if (event.key === "Escape") onClose();
        }

        window.addEventListener("keydown", handleKey);
        return () => {
            window.removeEventListener("keydown", handleKey);
        }
    }, [onClose]);

    const SettingsContent = settingsTabs[tab];

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-label="Configurações"
                onClick={(event) => event.stopPropagation()}>
                <header className={styles.header}>
                    <h2 className={styles.headerTitle}>Configurações</h2>
                    <button type="button" className={styles.closeBtn} aria-label="Fechar configurações" onClick={onClose}>
                        <X size={18} />
                    </button>
                </header>

                <div className={styles.content}>
                    <nav className={styles.nav} aria-label="Seções das configurações">
                        <button type="button" className={`${styles.navBtn} ${tab === "account" ? styles.navSelected : ""}`} aria-current={tab === "account" ? "page" : undefined} onClick={() => setTab("account")}><User size={16} /> Conta</button>
                        <button type="button" className={`${styles.navBtn} ${tab === "audio" ? styles.navSelected : ""}`} aria-current={tab === "audio" ? "page" : undefined} onClick={() => setTab("audio")}><Mic size={16} /> Áudio</button>
                        <button type="button" className={`${styles.navBtn} ${tab === "preferences" ? styles.navSelected : ""}`} aria-current={tab === "preferences" ? "page" : undefined} onClick={() => setTab("preferences")}><SlidersHorizontal size={16} /> Preferências</button>
                    </nav>

                    <SettingsContent />
                </div>
            </div>
        </div>
    )
}