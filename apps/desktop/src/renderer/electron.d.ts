
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
            version: string
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
        }
    }
}