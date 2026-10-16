import type { LucideIcon } from "lucide-react";

import styles from "./IconBtn.module.css";

interface IconBtnProps {
    id: string;
    icon: LucideIcon;
    disabledIcon?: LucideIcon;
    name: string;
    handleClick?: () => void;
    disabled?: boolean;
    active?: boolean;
    tone?: "danger" | "warn";
}

export default function IconBtn({ id, icon: Icon, disabledIcon: DisabledIcon, name, handleClick, disabled, active = false, tone = "danger" }: IconBtnProps) {

    const CurrentIcon = disabled && DisabledIcon
        ? DisabledIcon
        : Icon;

    return (
        <button
            className={`${styles.content} ${active ? (tone === "warn" ? styles.activeWarn : styles.activeDanger) : ""}`}
            id={id}
            name={name}
            title={name}
            aria-pressed={active}
            onClick={handleClick}>
            <CurrentIcon />
        </button>
    )
}