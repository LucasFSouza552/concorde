import type { CSSProperties } from "react";

import styles from "./UserAvatar.module.css";

interface UserAvatarProps {
    name: string;
    /** Foto (dataURL) vinda do perfil; null/undefined = iniciais. */
    avatar?: string | null;
    /** Cor de destaque (#rrggbb) aplicada como anel. */
    accent?: string | null;
    size?: number;
    round?: boolean;
    className?: string;
}

/**
 * Avatar unificado: foto quando existir, senão a inicial do nome.
 * Padrão em dicas/perfil/configurações; novas superfícies devem usá-lo.
 */
export default function UserAvatar({ name, avatar, accent, size = 36, round = true, className = "" }: UserAvatarProps) {
    const initial = name.trim().charAt(0).toUpperCase() || "?";

    const style: CSSProperties = {
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.38))
    };

    if (avatar) {
        style.backgroundImage = `url(${avatar})`;
    }

    if (accent) {
        style.boxShadow = `0 0 0 2px ${accent}`;
    }

    return (
        <span
            className={[styles.avatar, round ? styles.round : "", className].filter(Boolean).join(" ")}
            style={style}
            aria-hidden="true"
        >
            {avatar ? "" : initial}
        </span>
    );
}
