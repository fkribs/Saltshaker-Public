const { BrowserWindow } = require("electron");
const log = require("electron-log");

module.exports = function registerBrowserBridge({ ipcMain, pluginEvents }) {
  const windowsByPlugin = new Map();
  const subscribersByPlugin = new Map();

  function anySubscriberWants(pluginId, eventName) {
    return subscribersByPlugin.get(pluginId)?.has(eventName) ?? false;
  }

  function emit(pluginId, name, payload) {
    if (anySubscriberWants(pluginId, name)) {
      pluginEvents.emit("browser:event", { pluginId, name, payload });
    }
  }

  function openWindow(pluginId, options = {}) {
    const existing = windowsByPlugin.get(pluginId);
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return;
    }

    const win = new BrowserWindow({
      width: options.width ?? 1280,
      height: options.height ?? 720,
      title: options.title ?? "Saltshaker Browser",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    windowsByPlugin.set(pluginId, win);

    const handleUrl = (url) => emit(pluginId, "Navigated", { url });
    win.webContents.on("did-navigate", (_e, url) => handleUrl(url));
    win.webContents.on("did-navigate-in-page", (_e, url, isMainFrame) => {
      if (isMainFrame) handleUrl(url);
    });

    win.webContents.on("page-title-updated", (_e, title) => {
      emit(pluginId, "TitleChanged", { title, url: win.webContents.getURL() });
    });

    win.on("closed", () => {
      windowsByPlugin.delete(pluginId);
      emit(pluginId, "WindowClosed", null);
    });

    const url = options.url ?? "about:blank";
    win.loadURL(url);

    log.info(`[browserBridge] window opened for plugin ${pluginId} at ${url}`);
  }

  function closeWindow(pluginId) {
    const win = windowsByPlugin.get(pluginId);
    if (win && !win.isDestroyed()) win.close();
  }

  function getTitle(pluginId) {
    const win = windowsByPlugin.get(pluginId);
    if (!win || win.isDestroyed()) return null;
    return win.webContents.getTitle();
  }

  async function subscribe(pluginId, options) {
    const events = options?.events || [];
    let set = subscribersByPlugin.get(pluginId);
    if (!set) {
      set = new Set();
      subscribersByPlugin.set(pluginId, set);
    }
    for (const e of events) set.add(e);
    return "ok";
  }

  async function unsubscribe(pluginId, options = {}) {
    const events = options?.events || null;
    const set = subscribersByPlugin.get(pluginId);
    if (!set) return "ok";
    if (Array.isArray(events)) {
      for (const e of events) set.delete(e);
    } else {
      set.clear();
    }
    if (set.size === 0) subscribersByPlugin.delete(pluginId);
    return "ok";
  }

  function closeAllWindows() {
    for (const win of windowsByPlugin.values()) {
      if (win && !win.isDestroyed()) win.close();
    }
  }

  return { openWindow, closeWindow, closeAllWindows, subscribe, unsubscribe, getTitle };
};
