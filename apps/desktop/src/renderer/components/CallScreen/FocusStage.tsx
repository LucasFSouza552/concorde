import type { ReactNode } from "react";

import styles from "./CallScreen.module.css";

interface FocusStageProps {
    tileId: string;
    node: ReactNode;
}

export default function FocusStage({ tileId, node }: FocusStageProps) {
    return (
        <div className={styles.spotlight}>
            <div className={styles.focusStage} key={tileId}>
                {node}
            </div>
        </div>
    );
}
