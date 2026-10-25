/* eslint-disable react-refresh/only-export-components -- store de módulo: hook + provider no mesmo arquivo (padrão já usado em useFriend/ownStatus) */

import { createContext, useContext, useState, type ReactNode } from "react";

interface UIState {
    /** Painel lateral (listas) visível; controlado pela TopBar e por atalhos internos. */
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    toggleSidebar: () => void;
}

const UIContext = createContext<UIState | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const value: UIState = {
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar: () => setSidebarOpen((open) => !open),
    };

    return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIState {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error("useUI precisa estar dentro de <UIProvider>");
    }
    return context;
}
