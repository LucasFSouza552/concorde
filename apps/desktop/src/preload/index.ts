import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

interface UpdateStatus {
    state: "idle" | "available" | "downloading" | "ready";
    version?: string;
    percent?: number;
}

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
        getVersion: () => ipcRenderer.invoke("app:get-version")
    }
});