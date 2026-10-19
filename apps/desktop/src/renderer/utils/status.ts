import type { UserStatus } from "@concorde/shared";

export const STATUS_LABEL: Record<UserStatus, string> = {
    online: "Online",
    away: "Ausente",
    busy: "Ocupado",
    invisible: "Invisível",
    offline: "Offline",
};

export const STATUS_COLOR: Record<UserStatus, string> = {
    online: "var(--color-success)",
    away: "var(--color-warning)",
    busy: "var(--color-danger)",
    invisible: "var(--color-text-muted)",
    offline: "var(--color-text-muted)",
};

export const STATUS_GLOW: Record<UserStatus, string> = {
    online: "0 0 0 3px rgba(0, 255, 102, 0.16)",
    away: "0 0 0 3px rgba(255, 176, 32, 0.18)",
    busy: "0 0 0 3px rgba(255, 59, 92, 0.18)",
    invisible: "0 0 0 3px rgba(170, 167, 192, 0.16)",
    offline: "none",
};