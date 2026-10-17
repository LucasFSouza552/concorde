import { app, BrowserWindow, Menu, ipcMain, desktopCapturer } from 'electron'
import { autoUpdater } from 'electron-updater'
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs';
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

interface ScreenAudioSession {
  child: ChildProcess;
  sender: Electron.WebContents;
}

let screenAudioSession: ScreenAudioSession | null = null;

function captureExePath(): string {
  const name = "concorde-loopback-capture.exe";
  return app.isPackaged
    ? path.join(process.resourcesPath, "loopback", name)
    : path.join(app.getAppPath(), "resources", "loopback", name);
}

function stopScreenAudio() {
  if (!screenAudioSession) return;
  try { screenAudioSession.child.kill(); } catch { /* ignore */ }
  screenAudioSession = null;
}

function setupScreenAudio() {
  ipcMain.handle("screen-audio:start", async (event, pid: number) => {
    stopScreenAudio();
    if (!Number.isInteger(pid) || pid <= 0) return { ok: false, error: "PID invalido" };

    const exe = captureExePath();
    if (!fs.existsSync(exe)) {
      return { ok: false, error: "capturador nativo de audio indisponivel" };
    }

    const sender = event.sender;

    return await new Promise<{ ok: boolean; error?: string; rate?: number; channels?: number; bits?: number; encoding?: string }>((resolve) => {
      let settled = false;
      let headerDone = false;
      let buffer = Buffer.alloc(0);
      const child = spawn(exe, ["--pid", String(pid)], { windowsHide: true });

      const finishFail = (error: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { child.kill(); } catch { /* ignore */ }
        resolve({ ok: false, error });
      };

      const sendPcm = (buf: Buffer) => {
        if (buf.length === 0 || sender.isDestroyed()) return;
        try {
          sender.send("screen-audio:pcm", buf);
        } catch { /* janela fechada */ }
      };

      const timer = setTimeout(() => finishFail("timeout ao iniciar a captura de audio"), 5000);

      child.stdout?.on("data", (chunk: Buffer) => {
        if (!headerDone) {
          const combined = Buffer.from(chunk);
          const nl = combined.indexOf(0x0a);
          if (nl < 0) {
            buffer = Buffer.concat([buffer, combined]);
            return;
          }
          const headerLine = Buffer.concat([buffer, combined.subarray(0, nl)]).toString("utf8");
          const remainder = combined.subarray(nl + 1);
          let header: { rate?: number; channels?: number; bits?: number; encoding?: string };
          try {
            header = JSON.parse(headerLine);
          } catch {
            finishFail("cabecalho de audio invalido");
            return;
          }
          headerDone = true;
          buffer = Buffer.alloc(0);
          clearTimeout(timer);
          screenAudioSession = { child, sender };
          settled = true;
          sendPcm(remainder);
          resolve({ ok: true, rate: header.rate, channels: header.channels, bits: header.bits, encoding: header.encoding });
          return;
        }
        sendPcm(Buffer.from(chunk));
      });

      child.stderr?.on("data", (d: Buffer) => {
        const line = d.toString("utf8").trim();
        if (line) console.warn("[screen-audio:native]", line);
      });

      child.on("error", () => finishFail("falha ao executar o capturador nativo"));
      child.on("exit", () => {
        if (!settled) {
          finishFail("o capturador nativo encerrou prematuramente");
          return;
        }
        if (!sender.isDestroyed()) {
          try { sender.send("screen-audio:ended"); } catch { /* ignore */ }
        }
        if (screenAudioSession?.child === child) screenAudioSession = null;
      });
    });
  });

  ipcMain.handle("screen-audio:stop", () => {
    stopScreenAudio();
    return { ok: true };
  });
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

    window.webContents.openDevTools();
  } else {
    window.loadFile(
      path.join(__dirname, "../renderer/index.html")
    );
  }

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

  setupScreenAudio();

  ipcMain.handle("window:get-pid", async (_event, sourceId: string) => {
    try {
      if (!sourceId || !sourceId.startsWith("window:")) return null;
      const parts = sourceId.split(":");
      const hwndStr = parts[1];
      const hwnd = BigInt(hwndStr);
      const hwndNum = Number(hwnd > BigInt(Number.MAX_SAFE_INTEGER) ? hwndStr : hwnd);

      const { spawnSync } = await import("node:child_process");
      const script = [
        "Add-Type @\"",
        "using System;",
        "using System.Runtime.InteropServices;",
        "public class Win32 {",
        "  [DllImport(\"user32.dll\")]",
        "  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);",
        "}",
        "\"@;",
        `$h=[IntPtr]${hwndNum};`,
        "$procId=0;",
        "[void][Win32]::GetWindowThreadProcessId($h,[ref]$procId);",
        "Write-Output $procId"
      ].join("\n");

      const ps = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
        windowsHide: true,
        timeout: 3000
      });

      if (ps.error) return null;
      const out = (ps.stdout?.toString() || "").trim();
      const pid = parseInt(out);
      if (!Number.isFinite(pid) || pid <= 0) return null;
      return pid;
    } catch (err) {
      console.error("[window:get-pid]", err);
      return null;
    }
  });
});