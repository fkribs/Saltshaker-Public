const fs = require("fs/promises");
const path = require("path");
const { app } = require("electron");

class PluginSettingsManager {
  constructor() {
    this.filePath = path.join(app.getPath("userData"), "plugin-settings.json");
    this._cache = null;
  }

  async _load() {
    if (this._cache) return this._cache;
    try {
      this._cache = JSON.parse(await fs.readFile(this.filePath, "utf8"));
    } catch {
      this._cache = {};
    }
    return this._cache;
  }

  async _save() {
    await fs.writeFile(this.filePath, JSON.stringify(this._cache, null, 2), "utf8");
  }

  async getAll(pluginId) {
    const data = await this._load();
    return data[pluginId] || {};
  }

  async get(pluginId, key, fallback = undefined) {
    const all = await this.getAll(pluginId);
    return all[key] ?? fallback;
  }

  async set(pluginId, key, value) {
    const data = await this._load();
    if (!data[pluginId]) data[pluginId] = {};
    data[pluginId][key] = value;
    await this._save();
    return { ok: true };
  }
}

module.exports = PluginSettingsManager;
