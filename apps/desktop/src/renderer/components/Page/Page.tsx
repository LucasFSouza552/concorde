import type { ReactNode } from "react";

import styles from "./Page.module.css";

export default function Page({ children, hidden = false }: { children: ReactNode; hidden?: boolean }) {
    return <div hidden={hidden} className={styles.page} style={hidden ? { display: "none" } : undefined}>{children}</div>;
}