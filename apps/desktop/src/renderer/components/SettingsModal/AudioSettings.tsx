import { useSettings } from "../../contexts/SettingsProvider";
import FormCheckbox from "../Form/CheckBox/FormCheckbox";

import styles from "./SettingsModal.module.css";

export default function AudioSettings() {
    const { denoiseEnabled, setDenoiseEnabled } = useSettings().audio;

    return (
        <section className={styles.panel}>
            <h3 className={styles.panelTitle}>Áudio</h3>
            <p className={styles.panelDesc}>Como o seu microfone soa para os outros.</p>
            <div className={styles.settingRow}>
                <div>
                    <p className={styles.settingLabel}>Redução de ruído</p>
                    <p className={styles.settingHint}>Remove o ruído de fundo do microfone usando RNNoise. Desligar usa o áudio original.</p>
                </div>
                <FormCheckbox
                    id="denoise"
                    label=""
                    checked={denoiseEnabled}
                    onChange={(event) => setDenoiseEnabled(event.target.checked)}
                />
            </div>
        </section>
    );

}