import type { CSSProperties } from "react";

import type { UserStatus } from "@concorde/shared";

import { STATUS_COLOR, STATUS_LABEL } from "../../../../utils/status";

import styles from "./Friends.module.css";

interface UserIdentityProps {
    displayName: string;
    username: string;
    avatar?: string | null;
    large?: boolean;
    status?: UserStatus;
    discordVerified?: boolean;
    discordLinked?: boolean;
}

export default function UserIdentity({ displayName, username, avatar, large = false, status }: UserIdentityProps) {
    const initial = displayName.trim().charAt(0).toUpperCase() || "?";
    const avatarStyle: CSSProperties = avatar ? { backgroundImage: `url(${avatar})` } : {};

    return (
        <>
            <span className={`${styles.avatar} ${large ? styles.avatarLarge : ""}`} style={avatarStyle}>
                {avatar ? "" : initial}
                {status && (
                    <span
                        className={styles.statusDotList}
                        aria-hidden="true"
                        title={STATUS_LABEL[status]}
                        style={{ background: STATUS_COLOR[status] }}
                    />
                )}
            </span>
            <span className={styles.identity}>
                <strong className={large ? styles.nameLarge : ""}>{displayName}</strong>
                <small>@{username}</small>
            </span>
        </>
    );
}