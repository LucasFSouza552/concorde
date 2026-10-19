import { useEffect, useRef } from "react";

import styles from "./CallScreen.module.css";

export function ScreenVideo({ stream }: { stream: MediaStream }) {
    const ref = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        element.srcObject = stream;
        element.muted = true;

        const play = () => {
            void element.play().catch(() => { });
        };

        play();

        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") play();
        };

        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("focus", play);

        return () => {
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("focus", play);
        };
    }, [stream]);

    return <video ref={ref} className={styles.video} autoPlay playsInline />;
}