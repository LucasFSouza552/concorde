import { useSettings } from "../../contexts/SettingsProvider";
import FormCheckbox from "../Form/CheckBox/FormCheckbox";

export default function AudioSettings() {
    const { denoiseEnabled, setDenoiseEnabled } = useSettings().audio;

    return (
        <section>
            <h3>Áudio</h3>
            <FormCheckbox
                id="denoise"
                label="Redução de ruído"
                checked={denoiseEnabled}
                onChange={(event) => setDenoiseEnabled(event.target.checked)}
            />
            <p>Remove ruído de fundo do microfone usando RNNoise. Desligar usa o áudio original.</p>
        </section>
    );

}