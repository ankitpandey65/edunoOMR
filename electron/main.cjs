const { app, BrowserWindow, dialog, Menu, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");
const net = require("net");
const https = require("https");

const DEFAULT_PORT = 3000;
const CONFIG_FILE = "desktop-config.json";
let nextProcess = null;
let nextManagedByApp = false;
let currentPort = DEFAULT_PORT;
let mainWindow = null;

function parseVersion(v) {
  return String(v || "0.0.0")
    .trim()
    .replace(/^v/i, "")
    .split(".")
    .map((x) => Number.parseInt(x, 10) || 0);
}

function isVersionGreater(remote, local) {
  const r = parseVersion(remote);
  const l = parseVersion(local);
  const len = Math.max(r.length, l.length);
  for (let i = 0; i < len; i++) {
    const rv = r[i] ?? 0;
    const lv = l[i] ?? 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

function getConfigPath() {
  return path.join(app.getPath("userData"), CONFIG_FILE);
}

function getDefaultConfig() {
  return {
    port: DEFAULT_PORT,
    openAiApiKey: "",
    openAiOmrModel: "gpt-4.1-mini",
    autoCheckUpdates: false,
    updateManifestUrl: "",
    updateDownloadUrl: "",
  };
}

function loadDesktopConfig() {
  const cfgPath = getConfigPath();
  const defaults = getDefaultConfig();
  if (!fs.existsSync(cfgPath)) {
    fs.writeFileSync(cfgPath, JSON.stringify(defaults, null, 2), "utf8");
    return defaults;
  }
  try {
    const raw = fs.readFileSync(cfgPath, "utf8");
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function applyConfigToEnv(config) {
  if (!process.env.OPENAI_API_KEY && config.openAiApiKey) {
    process.env.OPENAI_API_KEY = String(config.openAiApiKey);
  }
  if (!process.env.OPENAI_OMR_MODEL && config.openAiOmrModel) {
    process.env.OPENAI_OMR_MODEL = String(config.openAiOmrModel);
  }
}

function ensureSqliteDb() {
  const userDataDir = app.getPath("userData");
  const dataDir = path.join(userDataDir, "data");
  const dbPath = path.join(dataDir, "eduno.db");
  const bundledDb = path.join(app.getAppPath(), "prisma", "dev.db");

  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbPath) && fs.existsSync(bundledDb)) {
    fs.copyFileSync(bundledDb, dbPath);
  }
  process.env.DATABASE_URL = `file:${dbPath}`;
}

function isTcpPortInUse(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(true));
    s.once("listening", () => {
      s.close(() => resolve(false));
    });
    s.listen(port, "127.0.0.1");
  });
}

function pingServer(url, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(Boolean(res.statusCode && res.statusCode < 500));
    });
    req.on("error", () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function resolvePort(preferredPort) {
  const safePreferred = Number.isFinite(preferredPort) ? preferredPort : DEFAULT_PORT;
  const preferredUrl = `http://127.0.0.1:${safePreferred}`;
  if (await pingServer(preferredUrl)) {
    return { port: safePreferred, useExistingServer: true };
  }
  if (!(await isTcpPortInUse(safePreferred))) {
    return { port: safePreferred, useExistingServer: false };
  }

  for (let p = safePreferred + 1; p <= safePreferred + 25; p++) {
    if (!(await isTcpPortInUse(p))) {
      return { port: p, useExistingServer: false };
    }
  }
  throw new Error("No free local port found near 3000.");
}

function waitForServer(url, timeoutMs = 90000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server responded ${res.statusCode ?? "unknown"} for too long.`));
        } else {
          setTimeout(check, 1000);
        }
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Timed out waiting for local server."));
        } else {
          setTimeout(check, 1000);
        }
      });
      req.setTimeout(5000, () => req.destroy());
    };
    check();
  });
}

function startNextServer(port) {
  if (nextProcess) return;
  const nextBin = require.resolve("next/dist/bin/next");
  const appPath = app.getAppPath();
  const cwd = appPath.endsWith(".asar") ? path.dirname(appPath) : appPath;
  nextProcess = spawn(process.execPath, [nextBin, "start", appPath, "-p", String(port)], {
    cwd,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "pipe",
  });
  nextManagedByApp = true;

  nextProcess.stdout.on("data", (buf) => {
    process.stdout.write(`[next] ${buf}`);
  });
  nextProcess.stderr.on("data", (buf) => {
    process.stderr.write(`[next] ${buf}`);
  });
}

function createWindow() {
  const appUrl = `http://127.0.0.1:${currentPort}`;
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "Eduno Exam",
  });
  mainWindow.loadURL(appUrl);
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https:") ? https : http;
    const req = mod.get(url, (res) => {
      if (!res.statusCode || res.statusCode >= 400) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode || "unknown"}`));
        return;
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (body += d));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error("Invalid update manifest JSON."));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(7000, () => req.destroy(new Error("Update request timeout")));
  });
}

async function checkForUpdates(config, showNoUpdate = false) {
  const manifestUrl = String(config.updateManifestUrl || "").trim();
  if (!manifestUrl) {
    if (showNoUpdate) {
      dialog.showMessageBox({
        type: "info",
        message: "Update URL not configured.",
        detail: `Set "updateManifestUrl" in ${CONFIG_FILE} to enable update checks.`,
      });
    }
    return;
  }
  try {
    const manifest = await fetchJson(manifestUrl);
    const remoteVersion = String(manifest.version || "").trim();
    const localVersion = app.getVersion();
    if (!remoteVersion) {
      throw new Error("Manifest missing version.");
    }
    if (isVersionGreater(remoteVersion, localVersion)) {
      const downloadUrl = String(manifest.url || config.updateDownloadUrl || "").trim();
      const detail = String(manifest.notes || "A newer version is available.");
      const result = await dialog.showMessageBox({
        type: "info",
        buttons: downloadUrl ? ["Download", "Later"] : ["OK"],
        defaultId: 0,
        cancelId: 1,
        message: `Update available: v${remoteVersion}`,
        detail,
      });
      if (downloadUrl && result.response === 0) {
        await shell.openExternal(downloadUrl);
      }
      return;
    }
    if (showNoUpdate) {
      dialog.showMessageBox({
        type: "info",
        message: "You are on the latest version.",
        detail: `Current version: v${localVersion}`,
      });
    }
  } catch (e) {
    if (showNoUpdate) {
      dialog.showErrorBox("Update check failed", e instanceof Error ? e.message : String(e));
    }
  }
}

function buildAppMenu(config) {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Open Data Folder",
          click: async () => {
            await shell.openPath(app.getPath("userData"));
          },
        },
        {
          label: "Open Desktop Config",
          click: async () => {
            const cfgPath = getConfigPath();
            if (!fs.existsSync(cfgPath)) {
              fs.writeFileSync(cfgPath, JSON.stringify(getDefaultConfig(), null, 2), "utf8");
            }
            await shell.openPath(cfgPath);
          },
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "View",
      submenu: [{ role: "reload" }, { role: "forceReload" }, { role: "toggleDevTools" }],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Check for Updates",
          click: async () => {
            await checkForUpdates(config, true);
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", () => {
  if (nextManagedByApp && nextProcess && !nextProcess.killed) {
    nextProcess.kill("SIGTERM");
  }
});

app.whenReady().then(async () => {
  try {
    const config = loadDesktopConfig();
    applyConfigToEnv(config);
    buildAppMenu(config);
    ensureSqliteDb();
    const preferredPort = Number(config.port || process.env.EDUNO_PORT || DEFAULT_PORT);
    const { port, useExistingServer } = await resolvePort(preferredPort);
    currentPort = port;
    if (!useExistingServer) {
      startNextServer(port);
    }
    await waitForServer(`http://127.0.0.1:${currentPort}`);
    createWindow();
    if (config.autoCheckUpdates) {
      checkForUpdates(config, false);
    }
  } catch (e) {
    dialog.showErrorBox(
      "Startup failed",
      `Unable to start Eduno Exam.\n\n${e instanceof Error ? e.message : String(e)}`
    );
    app.quit();
  }
});

