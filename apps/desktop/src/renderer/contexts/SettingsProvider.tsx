import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useAudioSettings } from "../hooks/useAudioSettings";

type SettingsContextData = {
    audio: ReturnType<typeof useAudioSettings>;
};

const SettingsContext = createContext<SettingsContextData | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const audio = useAudioSettings();
    const value = useMemo(() => ({ audio }), [audio]);
    return (<SettingsContext.Provider value={value}>
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