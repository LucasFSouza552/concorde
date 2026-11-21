import { createContext } from "react";
import type { DiscordRegistrationSuggestion, DiscordSensitiveAction } from "@concorde/shared";

export interface PendingDiscordRegistration {
    ticket: string;
    suggestion: DiscordRegistrationSuggestion;
}

export interface PendingDiscordConfirmation {
    id: string;
    action: DiscordSensitiveAction;
    expiresAt: number;
}

export interface DiscordOAuthContextData {
    busy: boolean;
    error: string | null;
    pendingRegistration: PendingDiscordRegistration | null;
    pendingConfirmation: PendingDiscordConfirmation | null;
    revision: number;
    startLogin: () => Promise<void>;
    startLink: () => Promise<void>;
    startSync: () => Promise<void>;
    requestSensitiveAction: (action: DiscordSensitiveAction) => Promise<void>;
    confirmRegistration: (username: string, displayName: string) => Promise<void>;
    cancelRegistration: () => void;
    cancelFlow: () => void;
    clearConfirmation: () => void;
    clearError: () => void;
}

export const DiscordOAuthContext = createContext<DiscordOAuthContextData | undefined>(undefined);
