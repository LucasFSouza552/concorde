import { useEffect, useRef } from "react";

interface RemoteAudioProps {
    stream: MediaStream;
    muted: boolean;
    volume?: number;
}

type StreamGraph = {
    source: MediaStreamAudioSourceNode;
    gain: GainNode;
};

const globalStore = globalThis as unknown as {
    __concordeAudioCtx?: AudioContext;
    __concordeGraphs?: WeakMap<MediaStream, StreamGraph>;
};

if (!globalStore.__concordeAudioCtx) {
    globalStore.__concordeAudioCtx = new AudioContext();
}
if (!globalStore.__concordeGraphs) {
    globalStore.__concordeGraphs = new WeakMap();
}

const ctx = globalStore.__concordeAudioCtx;
const graphs = globalStore.__concordeGraphs;

function getGraph(stream: MediaStream): StreamGraph {
    if (ctx.state === "suspended") {
        void ctx.resume().catch((err) => {
            console.warn("[RA] Falha ao resumir AudioContext:", err);
        });
    }

    let graph = graphs.get(stream);
    if (!graph) {
        const source = ctx.createMediaStreamSource(stream);
        const gain = ctx.createGain();
        source.connect(gain).connect(ctx.destination);
        graph = { source, gain };
        graphs.set(stream, graph);
    }
    return graph;
}

function applyGain(gainNode: GainNode, target: number) {
    const now = ctx.currentTime;
    const param = gainNode.gain;
    param.cancelScheduledValues(now);
    param.setTargetAtTime(target, now, 0.01);
}

export function RemoteAudio({ stream, muted, volume }: RemoteAudioProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const gainRef = useRef<GainNode | null>(null);

    useEffect(() => {
        const el = audioRef.current;
        if (!el || !stream) return;
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
    }, [stream]);

    useEffect(() => {
        const graph = getGraph(stream);
        gainRef.current = graph.gain;
        applyGain(graph.gain, muted ? 0 : (volume ?? 1));

        return () => {
            try {
                graph.source.disconnect();
                graph.gain.disconnect();
            } catch { }
            graphs.delete(stream);
            gainRef.current = null;
        };
    }, [stream]);

    useEffect(() => {
        const gainNode = gainRef.current;
        if (!gainNode) return;
        if (ctx.state === "suspended") void ctx.resume().catch(() => { });
        const target = muted ? 0 : ((volume && volume * 2) ?? 1);
        applyGain(gainNode, target);
    }, [muted, volume]);

    return <audio ref={audioRef} autoPlay muted playsInline style={{ display: "none" }} />;
}