import { app, BrowserWindow, Menu, ipcMain, desktopCapturer } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'node:path';

type UpdateState = "idle" | "available" | "downloading" | "ready";

interface UpdateStatus {
  state: UpdateState;
  version?: string;
  percent?: number;
}

let mainWindow: BrowserWindow | null = null;

function sendUpdateStatus(status: UpdateStatus) {
  mainWindow?.webContents.send("updates:status", status);
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    sendUpdateStatus({ state: "available", version: info.version });
  });

  autoUpdater.on("update-not-available", () => {
    sendUpdateStatus({ state: "idle" });
  });

  autoUpdater.on("download-progress", (progress) => {
    sendUpdateStatus({ state: "downloading", percent: progress.percent });
  });

  autoUpdater.on("update-downloaded", (info) => {
    sendUpdateStatus({ state: "ready", version: info.version });
  });

  autoUpdater.on("error", () => {
    sendUpdateStatus({ state: "idle" });
  });

  ipcMain.handle("updates:quit-and-install", () => {
    autoUpdater.quitAndInstall();
  });

  autoUpdater.checkForUpdates().catch(() => { });

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => { });
  }, 6 * 60 * 60 * 1000);
}

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

  mainWindow = window;
  window.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  setupAutoUpdater();

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

  ipcMain.handle("app:get-version", () => app.getVersion());
});