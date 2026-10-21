import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

interface UpdateStatus {
    state: "idle" | "available" | "downloading" | "ready";
    version?: string;
    percent?: number;
}

let onScreenAudioData: ((pcm: ArrayBuffer) => void) | null = null;
let onScreenAudioEnded: (() => void) | null = null;

ipcRenderer.on("screen-audio:pcm", (_event: IpcRendererEvent, chunk: Uint8Array) => {
    if (!onScreenAudioData) return;
    const u8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    const pcm = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
    onScreenAudioData(pcm);
});

ipcRenderer.on("screen-audio:ended", () => {
    onScreenAudioEnded?.();
});

contextBridge.exposeInMainWorld("concorde", {
    window: {
        minimize: () => ipcRenderer.send('window-minimize'),
        maximize: () => ipcRenderer.send('window-maximize'),
        close: () => ipcRenderer.send('window-close'),
    },
    screenShare: {
        getDesktopSources: () => ipcRenderer.invoke("screen-share:get-sources")
    },
    updates: {
        onStatus: (callback: (status: UpdateStatus) => void) => {
            const listener = (_event: IpcRendererEvent, status: UpdateStatus) => callback(status);
            ipcRenderer.on("updates:status", listener);
            return () => ipcRenderer.removeListener("updates:status", listener);
        },
        quitAndInstall: () => ipcRenderer.invoke("updates:quit-and-install")
    },
    app: {
        getVersion: () => ipcRenderer.invoke("app:get-version"),
        getAutoLaunch: () => ipcRenderer.invoke("app:get-auto-launch") as Promise<boolean>,
        setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke("app:set-auto-launch", enabled) as Promise<boolean>
    },
    windows: {
        getPid: (sourceId: string) => ipcRenderer.invoke("window:get-pid", sourceId) as Promise<number | null>
    },
    screenAudio: {
        start: (pid: number) => ipcRenderer.invoke("screen-audio:start", pid) as Promise<{
            ok: boolean;
            error?: string;
            rate?: number;
            channels?: number;
            bits?: number;
            encoding?: string;
        }>,
        stop: () => ipcRenderer.invoke("screen-audio:stop") as Promise<{ ok: boolean }>,
        setHandlers: (onData: (pcm: ArrayBuffer) => void, onEnded: () => void) => {
            onScreenAudioData = onData;
            onScreenAudioEnded = onEnded;
        },
        clearHandlers: () => {
            onScreenAudioData = null;
            onScreenAudioEnded = null;
        }
    }
});
