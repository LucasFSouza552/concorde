import type { UserStatus } from "@concorde/shared";

import { STATUS_COLOR, STATUS_LABEL } from "../../../../utils/status";
import styles from "./Friends.module.css";

interface UserIdentityProps {
    displayName: string;
    username: string;
    large?: boolean;
    status?: UserStatus;
}

export default function UserIdentity({ displayName, username, large = false, status }: UserIdentityProps) {
    const initial = displayName.trim().charAt(0).toUpperCase() || "?";

    return (
        <>
            <span className={`${styles.avatar} ${large ? styles.avatarLarge : ""}`}>
                {initial}
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
