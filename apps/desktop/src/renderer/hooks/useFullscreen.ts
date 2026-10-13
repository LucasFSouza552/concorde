import { useCallback, useEffect, useRef, useState } from "react";

export function useFullscreen<T extends HTMLElement>() {
    const ref = useRef<T | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        function handleFullscreenChange() {
            setIsFullscreen(document.fullscreenElement !== null);
        }
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    useEffect(() => {
        return () => {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => { });
            }
        };
    }, []);

    const toggle = useCallback(() => {
        if (document.fullscreenElement) {
            void document.exitFullscreen().catch(() => { });
            return;
        }
        if (!document.fullscreenEnabled) return;
        void ref.current?.requestFullscreen().catch(() => { });
    }, []);

    return { ref, isFullscreen, toggle };
}
