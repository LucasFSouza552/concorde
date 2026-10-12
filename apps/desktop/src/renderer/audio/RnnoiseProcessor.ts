import { RnnoiseWorkletNode, loadRnnoise } from "@sapphi-red/web-noise-suppressor";
import rnnoiseSimdWasmUrl from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";
import rnnoiseWasmUrl from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import rnnoiseWorkletUrl from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";

const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d];

export class RnnoiseProcessor {
    private source?: MediaStreamAudioSourceNode;
    private node?: RnnoiseWorkletNode;
    private sink?: MediaStreamAudioDestinationNode;
    private context?: AudioContext;

    async process(track: MediaStreamTrack): Promise<MediaStreamTrack> {
        await this.destroy();

        this.context = new AudioContext({ sampleRate: 48000, latencyHint: "interactive" });

        const [wasmBinary] = await Promise.all([
            loadRnnoise({ url: rnnoiseWasmUrl, simdUrl: rnnoiseSimdWasmUrl }).then((bytes) => {
                const magic = new Uint8Array(bytes.slice(0, 4));
                const valid = WASM_MAGIC.every((byte, index) => magic[index] === byte);
                if (!valid) {
                    throw new Error("Binário WASM inválido (magic bytes ausentes)");
                }

                return bytes;
            }),
            this.context.audioWorklet.addModule(rnnoiseWorkletUrl),
        ]);

        const stream = new MediaStream([track]);
        this.source = this.context.createMediaStreamSource(stream);
        this.sink = this.context.createMediaStreamDestination();
        this.node = new RnnoiseWorkletNode(this.context, { maxChannels: 1, wasmBinary });

        this.source.connect(this.node);
        this.node.connect(this.sink);

        return this.sink.stream.getAudioTracks()[0];
    }

    async destroy(): Promise<void> {
        try {
            this.source?.disconnect();
            this.node?.disconnect();
            this.sink?.disconnect();
        } finally {
            if (this.context) {
                await this.context.close();
            }
            this.source = undefined;
            this.node = undefined;
            this.sink = undefined;
            this.context = undefined;
        }
    }
}