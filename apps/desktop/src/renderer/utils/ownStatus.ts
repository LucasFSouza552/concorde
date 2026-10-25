import { useEffect, useState } from "react";

import type { UserStatus } from "@concorde/shared";

const STORAGE_KEY = "concorde.ownStatus";

const VALID: UserStatus[] = ["online", "away", "busy", "invisible"];

function initialStatus(): UserStatus {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && (VALID as string[]).includes(saved)) return saved as UserStatus;
    } catch {
        /* storage pode estar indisponível */
    }
    return "online";
}

let current: UserStatus = initialStatus();

const listeners = new Set<() => void>();

function notify(): void {
    listeners.forEach((listener) => listener());
}

export function getOwnStatus(): UserStatus {
    return current;
}

export function setOwnStatus(status: UserStatus): void {
    if (status === current) {
        return;
    }

    current = status;
    try {
        localStorage.setItem(STORAGE_KEY, status);
    } catch {
        /* ignore */
    }
    notify();
}

export function useOwnStatus(): UserStatus {
    const [, force] = useState(0);

    useEffect(() => {
        const listener = () => force((value) => value + 1);

        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }, []);

    return current;
}
