import { useEffect, useState } from "react";

import type { UserStatus } from "@concorde/shared";

const STORAGE_KEY = "concorde.ownStatus";
const MESSAGE_KEY = "concorde.ownCustomMessage";
const MAX_CUSTOM_MESSAGE = 80;

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

function initialCustomMessage(): string {
    try {
        return localStorage.getItem(MESSAGE_KEY) ?? "";
    } catch {
        return "";
    }
}

let current: UserStatus = initialStatus();
let customMessage = initialCustomMessage();

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

export function getOwnCustomMessage(): string {
    return customMessage;
}

export function setOwnCustomMessage(message: string): void {
    const next = message.trim().slice(0, MAX_CUSTOM_MESSAGE);

    if (next === customMessage) {
        return;
    }

    customMessage = next;
    try {
        if (next) localStorage.setItem(MESSAGE_KEY, next);
        else localStorage.removeItem(MESSAGE_KEY);
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

export function useOwnCustomMessage(): string {
    const [, force] = useState(0);

    useEffect(() => {
        const listener = () => force((value) => value + 1);

        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }, []);

    return customMessage;
}
