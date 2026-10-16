import type { ReactNode } from "react";

import ParticipantTile from "./ParticipantTile";

import styles from "./CallScreen.module.css";

export interface GridTile {
    id: string;
    node: ReactNode;
}

interface CallGridProps {
    tiles: GridTile[];
    ringingNames?: string[];
}

export default function CallGrid({ tiles, ringingNames = [] }: CallGridProps) {
    return (
        <div className={styles.grid}>
            {tiles.map((tile) => (
                <div className={styles.gridItem} key={tile.id}>
                    {tile.node}
                </div>
            ))}
            {ringingNames.map((name, index) => (
                <div className={styles.gridItem} key={`ringing-${index}`}>
                    <ParticipantTile
                        name={name}
                        muted={false}
                        ringing
                    />
                </div>
            ))}
        </div>
    );
}