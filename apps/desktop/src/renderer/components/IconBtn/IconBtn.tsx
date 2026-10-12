import type { LucideIcon } from "lucide-react";

import styles from "./IconBtn.module.css";

interface IconBtnProps {
    id: string;
    icon: LucideIcon;
    disabledIcon?: LucideIcon;
    name: string;
    handleClick?: () => void;
    disabled?: boolean;
}

export default function IconBtn({ id, icon: Icon, disabledIcon: DisabledIcon, name, handleClick, disabled }: IconBtnProps) {

    const CurrentIcon = disabled && DisabledIcon
        ? DisabledIcon
        : Icon;

    return (
        <button
            className={styles.content}
            id={id}
            name={name}
            onClick={handleClick}>
            <CurrentIcon />
        </button>
    )
}