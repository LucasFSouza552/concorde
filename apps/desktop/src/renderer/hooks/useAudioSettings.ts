import { useCallback, useState } from "react";

import type { SensitivityMode } from "../audio/SensitivityGate";

const STORAGE_KEY = "concorde:audio";

interface AudioSettings {
    denoiseEnabled: boolean;
    sensitivityMode: SensitivityMode;
    sensitivityThreshold: number;
}

const DEFAULTS: AudioSettings = {
    denoiseEnabled: true,
    sensitivityMode: "auto",
    sensitivityThreshold: 0.08,
};

function readSettings(): AudioSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AudioSettings>) };
    } catch {

    }
    return { ...DEFAULTS };
}

export function useAudioSettings() {
    const [settings, setSettings] = useState<AudioSettings>(readSettings);

    const update = useCallback((patch: Partial<AudioSettings>) => {
        setSettings((current) => {
            const next = { ...current, ...patch };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    const setDenoiseEnabled = useCallback(
        (enabled: boolean) => update({ denoiseEnabled: enabled }),
        [update]
    );

    const setSensitivityMode = useCallback(
        (mode: SensitivityMode) => update({ sensitivityMode: mode }),
        [update]
    );

    const setSensitivityThreshold = useCallback(
        (threshold: number) => update({ sensitivityThreshold: threshold }),
        [update]
    );

    return {
        denoiseEnabled: settings.denoiseEnabled,
        setDenoiseEnabled,
        sensitivityMode: settings.sensitivityMode,
        setSensitivityMode,
        sensitivityThreshold: settings.sensitivityThreshold,
        setSensitivityThreshold,
    };

}