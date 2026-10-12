import { useEffect, useState } from "react";
import { X } from "lucide-react";

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
                    <h2>Configurações</h2>
                    <button>
                        <X />
                    </button>
                </header>

                <div className={styles.content}>
                    <nav className={styles.nav}>
                        <button type="button" className={styles.navBtn} onClick={() => setTab("account")}>Conta</button>
                        <button type="button" className={styles.navBtn} onClick={() => setTab("audio")}>Áudio</button>
                        <button type="button" className={styles.navBtn} onClick={() => setTab("preferences")}>Preferências</button>
                    </nav>

                    <SettingsContent />
                </div>
            </div>
        </div>
    )
}