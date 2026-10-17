import { useEffect, useRef } from "react";

import styles from "./CallScreen.module.css";

export function ScreenVideo({ stream }: { stream: MediaStream }) {
    const ref = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        element.srcObject = stream;
        element.muted = true;
        element.play().catch(() => { });
    }, [stream]);

    return <video ref={ref} className={styles.video} autoPlay playsInline />;
}