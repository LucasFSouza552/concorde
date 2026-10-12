import { app, BrowserWindow, Menu, ipcMain, desktopCapturer } from 'electron'
import path from 'node:path';

function createWindow() {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,

    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    window.loadFile(
      path.join(__dirname, "../renderer/index.html")
    );
  }

  window.webContents.openDevTools();
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  ipcMain.on('window-minimize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    window.minimize();
  });

  ipcMain.on('window-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    window.isMaximized() ? window.unmaximize() : window.maximize();
  });

  ipcMain.on('window-close', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    window.close();
  });

  ipcMain.handle("screen-share:get-sources", async () => {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 320, height: 200 }
    });

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      isScreen: source.id.startsWith("screen:")
    }));
  });
});