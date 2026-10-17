import { useCallback, useState } from "react";

import type { SensitivityMode } from "../audio/SensitivityGate";

const STORAGE_KEY = "concorde:audio";

interface AudioSettings {
    denoiseEnabled: boolean;
    sensitivityMode: SensitivityMode;
    sensitivityThreshold: number;
    micDeviceId?: string;
    soundsEnabled: boolean;
    peerVoiceVolumes: Record<string, number>;
    peerShareAudios: Record<string, { muted: boolean; volume: number }>;
}

const DEFAULTS: AudioSettings = {
    denoiseEnabled: true,
    sensitivityMode: "auto",
    sensitivityThreshold: 0.08,
    micDeviceId: undefined,
    soundsEnabled: true,
    peerVoiceVolumes: {},
    peerShareAudios: {},
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

    const update = useCallback(
        (patch: Partial<AudioSettings> | ((cur: AudioSettings) => Partial<AudioSettings>)) => {
            setSettings((current) => {
                const resolved = typeof patch === "function" ? patch(current) : patch;
                const next = { ...current, ...resolved };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                return next;
            });
        },
        []
    );

    const setPeerVoiceVolume = useCallback(
        (userId: string, volume: number) =>
            update((cur) => ({ peerVoiceVolumes: { ...cur.peerVoiceVolumes, [userId]: volume } })),
        [update]
    );

    const setPeerShareAudio = useCallback(
        (userId: string, patch: { muted?: boolean; volume?: number }) =>
            update((cur) => {
                const stored = cur.peerShareAudios[userId];
                return {
                    peerShareAudios: {
                        ...cur.peerShareAudios,
                        [userId]: {
                            muted: patch.muted ?? stored?.muted ?? false,
                            volume: patch.volume ?? stored?.volume ?? 1
                        }
                    }
                };
            }),
        [update]
    );

    const setMicDeviceId = useCallback((micDeviceId: string | undefined) => update({ micDeviceId }), [update]);

    const setSoundsEnabled = useCallback((enabled: boolean) => update({ soundsEnabled: enabled }), [update]);

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
        micDeviceId: settings.micDeviceId,
        setMicDeviceId,
        soundsEnabled: settings.soundsEnabled,
        setSoundsEnabled,
        peerVoiceVolumes: settings.peerVoiceVolumes,
        setPeerVoiceVolume,
        peerShareAudios: settings.peerShareAudios,
        setPeerShareAudio,
    };

}