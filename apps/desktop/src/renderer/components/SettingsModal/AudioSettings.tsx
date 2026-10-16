import MicMeter from "./MicMeter";
import { useSettings } from "../../contexts/SettingsProvider";
import FormCheckbox from "../Form/CheckBox/FormCheckbox";

import styles from "./SettingsModal.module.css";

export default function AudioSettings() {
    const { denoiseEnabled, setDenoiseEnabled, sensitivityMode, sensitivityThreshold, setSensitivityMode, setSensitivityThreshold } = useSettings().audio;
    return (
        <section className={styles.panel}>
            <h3 className={styles.panelTitle}>Áudio</h3>
            <p className={styles.panelDesc}>Configure como sua voz é transmitida nas conversas do Concorde.</p>
            <div className={styles.settingRow}>
                <div>
                    <p className={styles.settingLabel}>Redução de ruído</p>
                    <p className={styles.settingHint}>Filtra ruídos de fundo para manter o foco na sua voz. Desative para transmitir o áudio original do microfone.</p>
                </div>
                <FormCheckbox
                    id="denoise"
                    label=""
                    checked={denoiseEnabled}
                    onChange={(event) => setDenoiseEnabled(event.target.checked)}
                />
            </div>
            <div className={styles.settingRow}>
                <div>
                    <p className={styles.settingLabel}>Sensibilidade do microfone</p>
                    <p className={styles.settingHint}>
                        Defina quando sua voz será transmitida. Uma sensibilidade maior prioriza falas mais altas; uma menor permite transmitir até mesmo quando você fala baixo.
                    </p>
                </div>
            </div>
            <div className={styles.settingRow} role="radiogroup" aria-label="Modo de sensibilidade">
                {(["auto", "manual", "off"] as const).map((mode) => (
                    <button
                        key={mode}
                        type="button"
                        className={`${styles.modeBtn} ${sensitivityMode === mode ? styles.modeSelected : ""}`}
                        aria-pressed={sensitivityMode === mode}
                        onClick={() => setSensitivityMode(mode)}
                    >
                        {mode === "auto" ? "Automática" : mode === "manual" ? "Manual" : "Desligada"}
                    </button>
                ))}
            </div>
            {sensitivityMode === "manual" && (
                <MicMeter valueLabel={String(Math.round(sensitivityThreshold * 100))}>
                    <input
                        type="range"
                        className={styles.rangeOverlay}
                        min={1}
                        max={40}
                        value={Math.round(sensitivityThreshold * 100)}
                        onChange={(e) => setSensitivityThreshold(Number(e.target.value) / 100)}
                        aria-label="Volume mínimo para transmitir"
                    />
                </MicMeter>
            )}
        </section>
    );

}