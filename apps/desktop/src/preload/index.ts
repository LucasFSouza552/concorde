import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("concorde", {
    version: "0.1.0",
    window: {
        minimize: () => ipcRenderer.send('window-minimize'),
        maximize: () => ipcRenderer.send('window-maximize'),
        close: () => ipcRenderer.send('window-close'),
    },
    screenShare: {
        getDesktopSources: () => ipcRenderer.invoke("screen-share:get-sources")
    }
});