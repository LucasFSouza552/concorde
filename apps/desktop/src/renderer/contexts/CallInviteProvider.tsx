import { createContext, useContext, type ReactNode } from "react";

import { useCallInvite } from "../hooks/useCallInvite";

type CallInviteContextData = ReturnType<typeof useCallInvite>;

const CallInviteContext = createContext<CallInviteContextData | null>(null);

export function CallInviteProvider({ children }: { children: ReactNode }) {
    const invite = useCallInvite();

    return (
        <CallInviteContext.Provider value={invite}>
            {children}
        </CallInviteContext.Provider>
    );
}

export function useCallInviteState() {
    const context = useContext(CallInviteContext);

    if (!context) {
        throw new Error("useCallInviteState must be used inside a CallInviteProvider");
    }

    return context;
}