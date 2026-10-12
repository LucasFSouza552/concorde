import { useEffect, useRef, useState } from "react";

import { RnnoiseProcessor } from "../audio/RnnoiseProcessor";
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
    const { denoiseEnabled } = useSettings().audio;

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

                const track = stream.getAudioTracks()[0];

                if (!denoiseEnabled) {
                    if (cancelled) {
                        stream.getTracks().forEach((track) => track.stop());
                        return;
                    }

                    rawStreamRef.current = stream;
                    localStreamRef.current = stream;
                    setLocalStream(stream);
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

                    const cleanStream = new MediaStream([clean]);

                    localStreamRef.current = cleanStream;
                    setLocalStream(cleanStream);
                    rawStreamRef.current = stream;
                } catch (error) {
                    console.warn(getErrorMessage(error));

                    if (cancelled) {
                        stream.getTracks().forEach((track) => track.stop());
                        return;
                    }

                    localStreamRef.current = stream;
                    setLocalStream(stream);
                }

            }).catch((error: unknown) => {
                setError(getErrorMessage(error));
            });
        return () => {
            cancelled = true;
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

        localStreamRef.current?.getTracks().forEach((t) => t.stop());

        localStreamRef.current = next;
        setLocalStream(next);

        return track;
    }

    return { localStream, getStream, switchMicrophone, error };
}