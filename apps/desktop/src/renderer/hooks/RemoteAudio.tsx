import { useEffect, useRef, type RefObject } from "react";

interface RemoteAudioProps {
    stream: MediaStream;
    muted: boolean;
    volume?: number;
}

// O elemento <audio> (mudo) serve para "acordar" o decodificador WebRTC;
// o som de verdade sai pela via WebAudio, com ganho por peer.
function warmUpDecoder(audioRef: RefObject<HTMLAudioElement | null>, stream: MediaStream): () => void {
    const el = audioRef.current;
    if (!el) return () => { };

    el.srcObject = stream;
    el.muted = true;
    el.play().catch((err: DOMException) => {
        if (err.name !== "AbortError") {
            console.warn("[RA] Falha ao acordar decodificador WebRTC:", err);
        }
    });

    return () => {
        el.pause();
        el.srcObject = null;
    };
}

export function RemoteAudio({ stream, muted, volume }: RemoteAudioProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const ctxRef = useRef<AudioContext | null>(null);
    const gainRef = useRef<GainNode | null>(null);

    useEffect(() => warmUpDecoder(audioRef, stream), [stream]);

    // Grafo por peer (AudioContext próprio) com ganho individual.
    useEffect(() => {
        if (!stream) return;

        const ctx = new AudioContext();
        if (ctx.state === "suspended") {
            void ctx.resume().catch(() => { });
        }

        const source = ctx.createMediaStreamSource(stream);
        const gain = ctx.createGain();
        source.connect(gain).connect(ctx.destination);

        ctxRef.current = ctx;
        gainRef.current = gain;

        const target = muted ? 0 : ((volume && volume * 2) ?? 1);
        gain.gain.value = target;

        return () => {
            try {
                source.disconnect();
                gain.disconnect();
            } catch { }
            gainRef.current = null;
            void ctx.close().catch(() => { });
            if (ctxRef.current === ctx) ctxRef.current = null;
        };
    }, [stream]); // volume/mudo reaplicados no efeito abaixo (sem reconstruir o nó)

    useEffect(() => {
        const gainNode = gainRef.current;
        const ctx = ctxRef.current;
        if (!gainNode || !ctx) return;

        if (ctx.state === "suspended") void ctx.resume().catch(() => { });

        const now = ctx.currentTime;
        const param = gainNode.gain;
        param.cancelScheduledValues(now);
        param.setTargetAtTime(muted ? 0 : ((volume && volume * 2) ?? 1), now, 0.01);
    }, [muted, volume, stream]);

    return <audio ref={audioRef} autoPlay muted playsInline style={{ display: "none" }} />;
}
