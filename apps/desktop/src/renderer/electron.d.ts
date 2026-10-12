
export { }

interface DesktopSource {
    id: string
    name: string
    thumbnail: string
    isScreen: boolean
}

declare global {
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
        }
    }
}