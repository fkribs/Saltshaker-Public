const { contextBridge, ipcRenderer } = require("electron");

const ALLOWED_CHANNELS = new Set([
  "connect",
  "disconnect",
  "setSession",
  "dolphin:Connected",
  "dolphin:Connecting",
  "dolphin:Disconnected",
  "dolphin:Error",
  "dolphin:GameStart",
  "dolphin:GameEnd",
  "plugins-installed",
  "plugins-uninstalled",
  "plugin-started",
  "plugin-stopped"
]);

function onAllowed(channel, callback) {
  if (!ALLOWED_CHANNELS.has(channel)) {
    throw new Error(`Denied: cannot listen on channel '${channel}'`);
  }

  const handler = (_evt, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.off(channel, handler);
}

const salt = {
  runInstalledPlugin(pluginId) {
    return ipcRenderer.invoke("run-plugin", pluginId);
  },

  getInstalledPlugins() {
    return ipcRenderer.invoke("list-installed-plugins");
  },

  installPlugin(payload) {
    return ipcRenderer.invoke("install-plugin", payload);
  },

  uninstallPlugin(pluginId) {
    return ipcRenderer.invoke("uninstall-plugin", pluginId);
  },

  onPluginInstalled(callback) {
    return onAllowed("plugins-installed", callback);
  },

  onPluginUninstalled(callback) {
    return onAllowed("plugins-uninstalled", callback);
  },
  getRunningPlugins() {
    return ipcRenderer.invoke("list-running-plugins");
  },

  stopPlugin(pluginId) {
    return ipcRenderer.invoke("stop-plugin", pluginId);
  },

  getPluginSettings(pluginId){
    return ipcRenderer.invoke("pluginSettings:getAll", pluginId);
  },

  setPluginSetting(pluginId, key, value){
    return ipcRenderer.invoke("pluginSettings:set", {pluginId, key, value});
  },

  onPluginSettingsChanged(callback) {
    ipcRenderer.on("plugin-settings.changed", (_e, payload) => callback(payload));
  },

  on(event, callback) {
    return onAllowed(event, callback);
  }
};

contextBridge.exposeInMainWorld("salt", salt);
