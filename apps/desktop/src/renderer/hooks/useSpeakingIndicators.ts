import { useEffect, useState } from "react";

const POLL_MS = 200;
const SPEAKING_THRESHOLD = 0.02;

export function useSpeakingIndicators(localStream: MediaStream | null, remoteStreams: Record<string, MediaStream>) {
    const [speaking, setSpeaking] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const entries: [string, MediaStream][] = [
            ...(localStream ? [["local", localStream] as [string, MediaStream]] : []),
            ...Object.entries(remoteStreams)
        ];

        if (entries.length === 0) return;
        const ctx = new AudioContext();
        void ctx.resume();

        const analysers = entries.map(([id, stream]) => {
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            source.connect(analyser);
            return { id, analyser, source };
        });

        const buffer = new Uint8Array(512);

        const timer = setInterval(() => {
            const next: Record<string, boolean> = {};
            for (const { id, analyser } of analysers) {
                analyser.getByteTimeDomainData(buffer);
                let sum = 0;
                for (let i = 0; i < buffer.length; i++) {
                    const v = (buffer[i] - 128) / 128;
                    sum += v * v;
                }
                next[id] = Math.sqrt(sum / buffer.length) > SPEAKING_THRESHOLD;
            }
            setSpeaking((prev) => {
                const changed =
                    Object.keys(next).some((k) => next[k] !== prev[k]) ||
                    Object.keys(prev).some((k) => !(k in next));
                return changed ? next : prev;
            });
        }, POLL_MS);

        return () => {
            clearInterval(timer);
            analysers.forEach(({ source }) => {
                try { source.disconnect(); } catch { /* ignore */ }
            });
            void ctx.close();
        };
    }, [localStream, remoteStreams]);

    return speaking;

}