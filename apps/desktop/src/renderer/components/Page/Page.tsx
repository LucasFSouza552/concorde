import type { ReactNode } from "react";

import styles from "./Page.module.css";

interface PageProps {
    children: ReactNode;
    hidden?: boolean;
    flush?: boolean;
}

export default function Page({ children, hidden = false, flush = false }: PageProps) {
    const className = flush ? `${styles.page} ${styles.pageFlush}` : styles.page;

    return <div hidden={hidden} className={className} style={hidden ? { display: "none" } : undefined}>{children}</div>;
}
