import { useEffect, useRef } from "react";

interface RemoteAudioProps {
    stream: MediaStream;
    muted: boolean;
};

export function RemoteAudio({ stream, muted }: RemoteAudioProps) {
    const ref = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const element = ref.current;

        if (!element) return;

        element.srcObject = stream;

        element.play().catch((error: DOMException) => {
            if (error.name === "AbortError") return;

            console.error("Falha ao tocar áudio remoto:", error);
        });

        return () => {
            element.pause();
            element.srcObject = null;
        };

    }, [stream]);

    return <audio ref={ref} autoPlay muted={muted} />;
}