const { app, ipcMain } = require("electron");
const log = require("electron-log");
const path = require("path");
const { EventEmitter } = require("events");

const WindowManager = require("./WindowManager");
const UpdateManager = require("./UpdateManager");
const PluginManager = require("./PluginManager");
const PluginSettingsManager = require("./PluginSettingsManager");

const registerFileBridge = require("./bridges/fileBridge");
const registerDolphinBridge = require("./bridges/dolphinBridge");

const isDev = !app.isPackaged;

// -------------------- Logging bootstrap --------------------
log.transports.file.level = "info";
log.transports.console.level = isDev ? "info" : false;

// -------------------- Environment --------------------
if (isDev) {
  const base = app.getPath("appData");
  app.setPath("userData", path.join(base, "Saltshaker-dev"));
  app.setAppUserModelId("com.fkribs.saltshaker.dev");

  app.commandLine.appendSwitch("remote-debugging-port", "9222");
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";

  log.info("[boot] dev mode enabled");
} else {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    log.info("[boot] another instance is running; quitting");
    app.quit();
  }
}

app.setAppUserModelId("com.fkribs.saltshaker");

// -------------------- Globals --------------------
let windowManager;
let updateManager;
let pluginManager;
let settingsManager;

const pluginEvents = new EventEmitter();
let _pluginEventsWiredToRenderer = false;

let fileBridge;
let dolphinBridge;

// -------------------- Helpers --------------------
function createMainWindow() {
  if (!windowManager) windowManager = new WindowManager();
  windowManager.createWindow();

  const wc = windowManager.getWebContents?.();
  if (isDev && wc) {
    try {
      wc.openDevTools({ mode: "detach" });
    } catch (err) {
      log.warn("[devtools]", err);
    }
  }
}

function setupManagers() {
  updateManager = updateManager || new UpdateManager();
  settingsManager = settingsManager || new PluginSettingsManager();
  pluginManager = pluginManager || new PluginManager(windowManager, pluginEvents, settingsManager);

  if (typeof pluginManager.setHostBridges === "function") {
    pluginManager.setHostBridges({ fileBridge, dolphinBridge });
  }
}


function wirePluginEventsToRenderer() {
  if (_pluginEventsWiredToRenderer) return;
  _pluginEventsWiredToRenderer = true;

  const wcSafeSend = (channel, payload) => {
    const wc = windowManager?.getWebContents?.();
    if (wc && !wc.isDestroyed()) {
      wc.send(channel, payload);
    } else {
      log.warn(`[pluginEvents->renderer] Dropped '${channel}'; renderer not ready`);
    }
  };

  const pluginAllow = new Set(["connect", "disconnect", "setSession"]);


  pluginEvents.on("plugin:event", (msg) => {
    if (!msg || !pluginAllow.has(msg.event)) return;

    wcSafeSend(msg.event, {
      pluginId: msg.pluginId,
      event: msg.event,
      data: (msg.args?.length ?? 0) <= 1 ? msg.args?.[0] : msg.args,
      pluginVersion: msg.pluginVersion,
      pluginCommit: msg.pluginCommit,
      atUtc: msg.atUtc,
    });
  });

  const dolphinAllow = new Set(["Connected", "Connecting", "Disconnected", "Error", "GameStart", "GameEnd"]);

  pluginEvents.on("dolphin:event", (msg) => {
    const name = msg?.name;
    if (!name || !dolphinAllow.has(name)) return;

    wcSafeSend(`dolphin:${name}`, msg.payload);
  });

  log.info(
    `[pluginEvents->renderer] Wired plugin:event + dolphin:* (dolphin allowlist size=${dolphinAllow.size})`
  );
}

// -------------------- IPC --------------------
function setupIpcMainListeners() {
  ipcMain.handle("install-plugin", async (_event, payload) => {
    log.info("[install-plugin]", payload.id);
    return pluginManager.installPlugin(payload);
  });

  ipcMain.handle("uninstall-plugin", async (_event, pluginId) => {
    log.info("[uninstall-plugin]", pluginId);
    return pluginManager.uninstallPlugin(pluginId);
  });

  ipcMain.handle("run-plugin", async (_event, pluginId) => {
    return pluginManager.runInstalledPlugin(pluginId);
  });

  ipcMain.handle("list-installed-plugins", async () => {
    return pluginManager.listInstalledPlugins();
  });

  ipcMain.handle("list-running-plugins", async () => {
    return pluginManager.listRunningPlugins(); // array of ids
  });

  ipcMain.handle("stop-plugin", async (_evt, pluginId) => {
    await pluginManager.stopPlugin(pluginId);
    return { ok: true };
  });

  ipcMain.handle("pluginSettings:getAll", async (_evt, pluginId) => {
    return await settingsManager.getAll(pluginId);
  });

  ipcMain.handle("pluginSettings:set", async (_evt, { pluginId, key, value }) => {
    const result = await settingsManager.set(pluginId, key, value);

    pluginManager?.pluginEvents?.emit("plugin:settingsChanged", {
      pluginId,
      key,
      value,
    });

    windowManager?.getWebContents?.()?.send("plugin-settings-changed", {
      pluginId,
      key,
      value,
    });

    return result;
  });
}

// -------------------- Bridges --------------------
function setupBridges() {
  const getPluginContext = async (pluginId) =>
    await pluginManager?.getInstalledPluginContext?.(pluginId);

  fileBridge = registerFileBridge({
    ipcMain,
    getPluginContext,
  });

  dolphinBridge = registerDolphinBridge({
    ipcMain,
    pluginEvents,
  });
}

// -------------------- Guards --------------------
function setupProcessGuards() {
  process.on("uncaughtException", (err) => {
    log.error("[uncaughtException]", err);
  });

  process.on("unhandledRejection", (reason) => {
    log.error("[unhandledRejection]", reason);
  });

  app.on("render-process-gone", (_e, details) => {
    log.error("[RendererGone]", details);
  });

  app.on("child-process-gone", (_e, details) => {
    log.error("[ChildGone]", details);
  });
}

// -------------------- App lifecycle --------------------
app.whenReady().then(() => {
  log.info("[boot] isPackaged =", app.isPackaged);
  log.info("[boot] version =", app.getVersion());
  log.info("[boot] execPath =", process.execPath);
  log.info("[boot] resourcesPath =", process.resourcesPath);
  log.info("[boot] userData =", app.getPath("userData"));
  log.info("[boot] logFile =", log.transports.file.getFile().path);

  setupProcessGuards();

  createMainWindow();

  wirePluginEventsToRenderer();

  setupManagers();
  setupBridges();

  if (typeof pluginManager.setHostBridges === "function") {
    pluginManager.setHostBridges({ fileBridge, dolphinBridge });
  }

  setupIpcMainListeners();

  try {
    log.info("[boot] invoking updateManager.checkForUpdates()");
    updateManager.checkForUpdates();
  } catch (err) {
    log.warn("[update] checkForUpdates failed:", err?.message || err);
  }
});

app.on("activate", () => {
  if (!windowManager?.window) {
    createMainWindow();
    wirePluginEventsToRenderer();
    setupManagers();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async () => {
  try {
    await pluginManager?.disposeAllPlugins?.();
  } catch (e) {
    log.warn("disposeAllPlugins failed during shutdown", e);
  }
});
