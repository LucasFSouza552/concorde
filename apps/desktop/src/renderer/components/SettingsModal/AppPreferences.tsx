import { useEffect, useState } from "react";

import styles from "./SettingsModal.module.css";
import FormCheckbox from "../Form/CheckBox/FormCheckbox";

export default function AppPreferences() {
    const [autoLaunch, setAutoLaunch] = useState<boolean | null>(null);

    useEffect(() => {
        let cancelled = false;

        window.concorde.app.getAutoLaunch()
            .then((enabled) => { if (!cancelled) setAutoLaunch(enabled); })
            .catch(() => { if (!cancelled) setAutoLaunch(false); });

        return () => { cancelled = true; };
    }, []);

    async function handleAutoLaunchChange(e: React.ChangeEvent<HTMLInputElement>) {
        const next = e.target.checked;
        const previous = autoLaunch ?? false;

        setAutoLaunch(next);
        try {
            await window.concorde.app.setAutoLaunch(next);
        } catch {
            setAutoLaunch(previous);
        }
    }

    return (
        <section className={styles.panel}>
            <h3 className={styles.panelTitle}>Preferências</h3>
            <p className={styles.panelDesc}>Ajustes gerais do aplicativo.</p>
            <div className={styles.settingRow}>
                <div>
                    <p className={styles.settingLabel}>Iniciar junto com o Windows</p>
                    <p className={styles.settingHint}>O Concorde abre automaticamente, em tela, quando o Windows iniciar.</p>
                </div>
                <FormCheckbox
                    id="auto-launch"
                    label=""
                    checked={autoLaunch ?? false}
                    onChange={(e) => void handleAutoLaunchChange(e)}
                />
            </div>
        </section>
    );
}
