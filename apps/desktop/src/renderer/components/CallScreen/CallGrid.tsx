import type { ReactNode } from "react";

import ParticipantTile from "./ParticipantTile";

import styles from "./CallScreen.module.css";

export interface GridTile {
    id: string;
    node: ReactNode;
}

interface CallGridProps {
    tiles: GridTile[];
    ringingName?: string;
}

export default function CallGrid({ tiles, ringingName }: CallGridProps) {
    return (
        <div className={styles.grid}>
            {tiles.map((tile) => (
                <div className={styles.gridItem} key={tile.id}>
                    {tile.node}
                </div>
            ))}
            {ringingName !== undefined && (
                <div className={styles.gridItem}>
                    <ParticipantTile
                        name={ringingName}
                        muted={false}
                        ringing
                    />
                </div>
            )}
        </div>
    );
}