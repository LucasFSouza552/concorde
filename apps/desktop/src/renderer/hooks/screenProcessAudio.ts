// Captura nativa de audio por processo (WASAPI Process Loopback).
//
// O processo main executa um helper nativo que captura SOMENTE o audio da
// arvore de processos da janela escolhida e envia PCM cru via IPC. Aqui
// convertemos esse PCM em um MediaStreamTrack via AudioWorklet, para entrar
// no mesmo caminho de envio ja usado pelo compartilhamento de tela.

const WORKLET_SOURCE = `
class ConcordePcmPlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.offset = 0;
    this.channels = 2;
    this.port.onmessage = (event) => {
      const d = event.data;
      if (d.type === "pcm") {
        this.queue.push(new Float32Array(d.samples));
        if (this.queue.length > 400) this.queue.shift();
      } else if (d.type === "flush") {
        this.queue.length = 0;
        this.offset = 0;
      }
    };
  }
  process(_inputs, outputs) {
    const out = outputs[0];
    if (!out || out.length === 0) return true;
    const frames = out[0].length;
    let written = 0;
    while (written < frames && this.queue.length > 0) {
      const buf = this.queue[0];
      const avail = buf.length - this.offset;
      const need = (frames - written) * this.channels;
      const take = avail < need ? avail : need;
      const takeFrames = Math.floor(take / this.channels);
      for (let f = 0; f < takeFrames; f++) {
        for (let c = 0; c < out.length; c++) {
          const idx = this.offset + f * this.channels + (c < this.channels ? c : 0);
          out[c][written + f] = buf[idx];
        }
      }
      this.offset += takeFrames * this.channels;
      written += takeFrames;
      if (this.offset >= buf.length) {
        this.queue.shift();
        this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor("concorde-pcm-player", ConcordePcmPlayer);
`;

let active: { ctx: AudioContext; node: AudioWorkletNode } | null = null;

export async function startWindowAudio(pid: number): Promise<MediaStreamTrack> {
    const bridge = window.concorde?.screenAudio;
    if (!bridge || typeof bridge.setHandlers !== "function") {
        throw new Error("captura nativa de audio indisponivel");
    }

    stopWindowAudio();

    const ctx = new AudioContext({ sampleRate: 48000 });
    const blob = new Blob([WORKLET_SOURCE], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    try {
        await ctx.audioWorklet.addModule(url);
    } finally {
        URL.revokeObjectURL(url);
    }

    const node = new AudioWorkletNode(ctx, "concorde-pcm-player", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
    });
    const dest = ctx.createMediaStreamDestination();
    node.connect(dest);

    let channels = 2;

    bridge.setHandlers(
        (pcm: ArrayBuffer) => {
            const i16 = new Int16Array(pcm);
            const frames = Math.floor(i16.length / channels);
            if (frames <= 0) return;
            const f32 = new Float32Array(frames * 2);
            for (let f = 0; f < frames; f++) {
                const l = i16[f * channels] ?? 0;
                const r = channels > 1 ? (i16[f * channels + 1] ?? 0) : l;
                f32[f * 2] = l / 32768;
                f32[f * 2 + 1] = r / 32768;
            }
            try {
                node.port.postMessage({ type: "pcm", samples: f32.buffer }, [f32.buffer]);
            } catch { /* node encerrado */ }
        },
        () => { stopWindowAudio(); },
    );

    await ctx.resume();

    let started: Awaited<ReturnType<typeof bridge.start>>;
    try {
        started = await bridge.start(pid);
    } catch (err) {
        bridge.clearHandlers?.();
        try { void ctx.close(); } catch { /* ignore */ }
        throw err;
    }

    if (!started?.ok) {
        bridge.clearHandlers?.();
        try { void ctx.close(); } catch { /* ignore */ }
        throw new Error(started?.error ?? "falha ao iniciar a captura de audio");
    }

    if (started.channels && started.channels > 0) channels = started.channels;

    active = { ctx, node };

    const track = dest.stream.getAudioTracks()[0];
    if (!track) {
        stopWindowAudio();
        throw new Error("nao foi possivel criar a faixa de audio da janela");
    }
    return track;
}

export function stopWindowAudio() {
    try { window.concorde?.screenAudio?.clearHandlers?.(); } catch { /* ignore */ }
    try { void window.concorde?.screenAudio?.stop(); } catch { /* ignore */ }
    if (!active) return;
    try { active.node.disconnect(); } catch { /* ignore */ }
    try { void active.ctx.close(); } catch { /* ignore */ }
    active = null;
}
