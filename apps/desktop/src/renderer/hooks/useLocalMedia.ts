import { useEffect, useRef, useState } from "react";

import { RnnoiseProcessor } from "../audio/RnnoiseProcessor";
import { SensitivityGate } from "../audio/SensitivityGate";
import { useSettings } from "../contexts/SettingsProvider";

import { getErrorMessage } from "../api/api";

interface UseLocalMediaResult {
    localStream: MediaStream | null;

    getStream: () => MediaStream | null;
    switchMicrophone: (next: MediaStream) => MediaStreamTrack | null;
    error: string | null;
}

export function useLocalMedia(active: boolean): UseLocalMediaResult {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const rawStreamRef = useRef<MediaStream | null>(null);
    const switchedRef = useRef(false);
    const processorRef = useRef<RnnoiseProcessor>(null);
    const gateRef = useRef<SensitivityGate | null>(null);
    const gateCtxRef = useRef<AudioContext | null>(null);
    const { denoiseEnabled, sensitivityMode, sensitivityThreshold } = useSettings().audio;

    function teardownGate() {
        gateRef.current?.destroy();
        gateRef.current = null;
        if (gateCtxRef.current) {
            void gateCtxRef.current.close().catch(() => { });
            gateCtxRef.current = null;
        }
    }

    useEffect(() => {
        gateRef.current?.setOptions({ mode: sensitivityMode, manualThreshold: sensitivityThreshold });
    }, [sensitivityMode, sensitivityThreshold]);

    useEffect(() => {
        if (!active) return;
        setError(null);
        let cancelled = false;

        navigator.mediaDevices
            .getUserMedia({
                audio: {
                    noiseSuppression: false,
                    echoCancellation: true
                }, video: false
            })
            .then(async (stream) => {
                if (cancelled || switchedRef.current) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }

                async function gateTrack(sendTrack: MediaStreamTrack, observeStream: MediaStream): Promise<MediaStreamTrack | null> {
                    try {
                        const ctx = new AudioContext();
                        if (ctx.state === "suspended") {
                            await ctx.resume().catch(() => { });
                        }
                        const source = ctx.createMediaStreamSource(new MediaStream([sendTrack]));
                        const gateGain = ctx.createGain();
                        gateGain.gain.value = 1;
                        const sink = ctx.createMediaStreamDestination();
                        source.connect(gateGain);
                        gateGain.connect(sink);

                        const gated = sink.stream.getAudioTracks()[0];
                        if (!gated) {
                            void ctx.close().catch(() => { });
                            return null;
                        }

                        const gate = new SensitivityGate();
                        await gate.connect(observeStream);
                        gate.onChange = (open) => {
                            const t = ctx.currentTime;
                            gateGain.gain.cancelScheduledValues(t);
                            gateGain.gain.setTargetAtTime(open ? 1 : 0, t, open ? 0.005 : 0.01);
                        };
                        gate.setOptions({ mode: sensitivityMode, manualThreshold: sensitivityThreshold });

                        gateRef.current = gate;
                        gateCtxRef.current = ctx;
                        return gated;
                    } catch {
                        return null;
                    }
                }

                const track = stream.getAudioTracks()[0];

                if (!denoiseEnabled) {
                    if (cancelled) {
                        stream.getTracks().forEach((track) => track.stop());
                        return;
                    }

                    const gated = await gateTrack(track, stream);
                    if (cancelled) {
                        teardownGate();
                        stream.getTracks().forEach((track) => track.stop());
                        return;
                    }

                    rawStreamRef.current = stream;
                    const finalStream = new MediaStream([gated ?? track]);
                    localStreamRef.current = finalStream;
                    setLocalStream(finalStream);
                    return;

                }

                try {
                    if (!processorRef.current) {
                        processorRef.current = new RnnoiseProcessor();
                    }

                    const clean = await processorRef.current.process(track);
                    if (cancelled) {
                        clean.stop();
                        return;
                    }

                    const gated = await gateTrack(clean, stream);
                    if (cancelled) {
                        teardownGate();
                        clean.stop();
                        return;
                    }

                    const cleanStream = new MediaStream([gated ?? clean]);

                    localStreamRef.current = cleanStream;
                    setLocalStream(cleanStream);
                    rawStreamRef.current = stream;
                } catch (error) {
                    console.warn(getErrorMessage(error));

                    if (cancelled) {
                        stream.getTracks().forEach((track) => track.stop());
                        return;
                    }

                    const gated = await gateTrack(track, stream);
                    if (cancelled) {
                        teardownGate();
                        stream.getTracks().forEach((track) => track.stop());
                        return;
                    }

                    const fallbackStream = new MediaStream([gated ?? track]);
                    localStreamRef.current = fallbackStream;
                    setLocalStream(fallbackStream);
                }

            }).catch((error: unknown) => {
                setError(getErrorMessage(error));
            });
        return () => {
            cancelled = true;
            teardownGate();
            void processorRef.current?.destroy();
            processorRef.current = null;
            localStreamRef.current?.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
            rawStreamRef.current?.getTracks().forEach((track) => track.stop());
            rawStreamRef.current = null;
        };

    }, [active, denoiseEnabled]);

    function getStream() {
        return localStreamRef.current;
    }

    function switchMicrophone(next: MediaStream): MediaStreamTrack | null {
        const track = next.getAudioTracks()[0];

        if (!track) return null;
        switchedRef.current = true;

        teardownGate();
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        rawStreamRef.current?.getTracks().forEach((t) => t.stop());
        rawStreamRef.current = null;

        localStreamRef.current = next;
        setLocalStream(next);

        return track;
    }

    return { localStream, getStream, switchMicrophone, error };
}