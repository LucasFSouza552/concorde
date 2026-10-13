import { createContext, useContext, type ReactNode } from "react";

import type { UserSocketServerMessage } from "@concorde/shared";

import { useUserSocket } from '../hooks/useUserSocket';

const UserSocketContext = createContext<UserSocketServerMessage | null>(null);
const UserSocketStatusContext = createContext(false);
const UserSocketSendContext = createContext<(message: unknown) => void>(() => { });

export function UserSocketProvider({ children }: { children: ReactNode }) {
    const { lastEvent, connected, send } = useUserSocket();

    return (
        <UserSocketContext.Provider value={lastEvent}>
            <UserSocketStatusContext.Provider value={connected}>
                <UserSocketSendContext.Provider value={send}>
                    {children}
                </UserSocketSendContext.Provider>
            </UserSocketStatusContext.Provider>
        </UserSocketContext.Provider>
    )
}

export function useUserSocketEvent() {
    const event = useContext(UserSocketContext);

    if (event === undefined) {
        throw new Error("useUserSocketEvent must be used inside a UserSocketProvider");
    }

    return event;
}

export function useUserSocketConnected() {
    return useContext(UserSocketStatusContext);
}

export function useUserSocketSend() {
    return useContext(UserSocketSendContext);
}