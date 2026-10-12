import { useEffect, useRef } from "react";

import styles from "./CallScreen.module.css";

export function ScreenVideo({ stream, muted = false }: { stream: MediaStream; muted?: boolean }) {
    const ref = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        element.srcObject = stream;
        element.muted = muted;
        element.play().catch(() => { });
    }, [stream, muted]);

    return <video ref={ref} className={styles.video} autoPlay playsInline />;
}