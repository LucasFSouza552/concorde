import type {
    DiscordCallbackResult,
    DiscordEvent,
    DiscordIntegrationStatus,
    DiscordOauthStart,
    DiscordSensitiveAction,
    DiscordSyncedResult,
    LoginTokensResponse,
    User
} from "@concorde/shared";

import { api } from "./api";

export function startDiscordLogin(): Promise<DiscordOauthStart> {
    return api.post<DiscordOauthStart>("/auth/discord/login/start").then((response) => response.data);
}

export function startDiscordLink(): Promise<DiscordOauthStart> {
    return api.post<DiscordOauthStart>("/auth/discord/link/start").then((response) => response.data);
}

export function exchangeDiscordCode(code: string, state: string): Promise<DiscordCallbackResult> {
    return api.post<DiscordCallbackResult>("/auth/discord/callback", {
        code,
        state,
        iss: "https://discord.com"
    }).then((response) => response.data);
}

export function registerWithDiscord(ticket: string, username: string, displayName: string): Promise<LoginTokensResponse> {
    return api.post<LoginTokensResponse>("/auth/discord/register", {
        ticket,
        username,
        displayName
    }).then((response) => response.data);
}

export function getDiscordIntegration(): Promise<DiscordIntegrationStatus> {
    return api.get<DiscordIntegrationStatus>("/auth/me/discord").then((response) => response.data);
}

export function unlinkDiscord(): Promise<{ status: "unlinked" }> {
    return api.delete<{ status: "unlinked" }>("/auth/me/discord").then((response) => response.data);
}

export function setupDiscordPassword(password: string): Promise<{ status: "updated" }> {
    return api.post<{ status: "updated" }>("/auth/me/password/setup", { password }).then((response) => response.data);
}

export function startDiscordSync(): Promise<DiscordOauthStart> {
    return api.post<DiscordOauthStart>("/auth/discord/sync/start").then((response) => response.data);
}

export function startDiscordReauth(action: DiscordSensitiveAction): Promise<DiscordOauthStart> {
    return api.post<DiscordOauthStart>("/auth/discord/reauth/start", { action }).then((response) => response.data);
}

export function getDiscordEvents(): Promise<{ events: DiscordEvent[] }> {
    return api.get<{ events: DiscordEvent[] }>("/auth/me/discord/events").then((response) => response.data);
}

export function setDiscordShowcase(enabled: boolean): Promise<DiscordIntegrationStatus> {
    return api.patch<DiscordIntegrationStatus>("/auth/me/discord/showcase", { enabled }).then((response) => response.data);
}

export function applyDiscordProfile(): Promise<DiscordSyncedResult> {
    return api.post<DiscordSyncedResult>("/auth/me/discord/apply").then((response) => response.data);
}

export function setDiscordAutoSync(enabled: boolean): Promise<DiscordIntegrationStatus> {
    return api.patch<DiscordIntegrationStatus>("/auth/me/discord/auto-sync", { enabled }).then((response) => response.data);
}

export function changeEmailWithDiscord(email: string, confirmationId: string): Promise<User> {
    return api.patch<User>("/auth/me/email", { email, confirmationId }).then((response) => response.data);
}

export function changePasswordWithDiscord(
    currentPassword: string,
    newPassword: string,
    confirmationId: string
): Promise<{ status: "updated" }> {
    return api.post<{ status: "updated" }>("/auth/me/password", {
        currentPassword,
        newPassword,
        confirmationId
    }).then((response) => response.data);
}
