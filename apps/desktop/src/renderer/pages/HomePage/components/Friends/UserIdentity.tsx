import type { CSSProperties } from "react";
import { BadgeCheck } from "lucide-react";

import DiscordIcon from "../../../../components/DiscordIcon/DiscordIcon";
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

export default function UserIdentity({ displayName, username, avatar, large = false, status, discordVerified, discordLinked }: UserIdentityProps) {
    const initial = displayName.trim().charAt(0).toUpperCase() || "?";
    const avatarStyle: CSSProperties = avatar ? { backgroundImage: `url(${avatar})` } : {};
    const linked = Boolean(discordLinked || discordVerified);

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
                <strong className={large ? styles.nameLarge : ""}>
                    {displayName}
                    {linked && (
                        <span
                            className={styles.discordBadge}
                            title={discordVerified ? "Conta verificada no Discord" : "Conta vinculada ao Discord"}
                        >
                            <DiscordIcon size={13} />
                            {discordVerified && <BadgeCheck size={10} />}
                            Discord
                        </span>
                    )}
                </strong>
                <small>@{username}</small>
            </span>
        </>
    );
}