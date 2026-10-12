import { useCallback, useState } from "react";

const STORAGE_KEY = "concorde:audio";

interface AudioSettings {
    denoiseEnabled: boolean;
}

function readSettings(): AudioSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) as AudioSettings;
    } catch {

    }
    return { denoiseEnabled: true };
}

export function useAudioSettings() {
    const [settings, setSettings] = useState<AudioSettings>(readSettings);

    const setDenoiseEnabled = useCallback((enabled: boolean) => {
        setSettings((current) => {
            const next = { ...current, denoiseEnabled: enabled };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    return { denoiseEnabled: settings.denoiseEnabled, setDenoiseEnabled };
}