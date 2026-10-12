import { createContext, useContext, type ReactNode } from "react";

import { useAudioSettings } from "../hooks/useAudioSettings";

type SettingsContextData = {
    audio: ReturnType<typeof useAudioSettings>;
};

const SettingsContext = createContext<SettingsContextData | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const audio = useAudioSettings();

    return (<SettingsContext.Provider value={{ audio }}>
        {children}
    </SettingsContext.Provider>);
}

export function useSettings() {
    const context = useContext(SettingsContext);

    if (!context) {
        throw new Error("useSettings must be used inside a SettingsProvider");
    }

    return context;
}