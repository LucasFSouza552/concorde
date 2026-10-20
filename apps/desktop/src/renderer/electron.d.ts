
export { }

interface DesktopSource {
    id: string
    name: string
    thumbnail: string
    isScreen: boolean
}

declare global {
    interface UpdateStatus {
        state: "idle" | "available" | "downloading" | "ready"
        version?: string
        percent?: number
    }

    interface Window {
        concorde: {
            window: {
                minimize: () => void
                maximize: () => void
                close: () => void
            }
            screenShare: {
                getDesktopSources: () => Promise<DesktopSource[]>
            }
            updates: {
                onStatus: (callback: (status: UpdateStatus) => void) => () => void
                quitAndInstall: () => Promise<void>
            }
            app: {
                getVersion: () => Promise<string>
            }
            windows: {
                getPid: (sourceId: string) => Promise<number | null>
            }
            screenAudio: {
                start: (pid: number) => Promise<{
                    ok: boolean;
                    error?: string;
                    rate?: number;
                    channels?: number;
                    bits?: number;
                    encoding?: string;
                }>;
                stop: () => Promise<{ ok: boolean }>;
                setHandlers: (onData: (pcm: ArrayBuffer) => void, onEnded: () => void) => void;
                clearHandlers: () => void;
            }
        }
    }
}