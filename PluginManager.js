const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const vm = require("vm");
const { spawn } = require("child_process");
const { EventEmitter } = require("events");
const tar = require("tar");
const log = require("electron-log");
const { app } = require("electron");

class PluginManager {
  constructor(windowManager, pluginEvents, settingsManager, { isDev = false } = {}) {
    this.isDev = isDev;
    this.installedPluginContexts = new Map();
    this.windowManager = windowManager;
    this.settingsManager = settingsManager;

    this.pluginEvents = pluginEvents || new EventEmitter();

    this.activePlugins = new Map();
    this._activationQueue = Promise.resolve();
    this._currentPluginId = null;
    this.pluginsDir = path.join(app.getPath("userData"), "plugins");

    this.fileBridge = null;
    this.dolphinBridge = null;
    this.browserBridge = null;

    this._contextsHydrated = false;
    this._wireGlobalRoutingOnce();
  }
  async stopPlugin(pluginId) {
    const active = this.activePlugins.get(pluginId);
    if (!active) return;

    try {
      await active.onDispose?.();
    } finally {
      this.activePlugins.delete(pluginId);
      if (this._currentPluginId === pluginId) this._currentPluginId = null;
      this._emitPluginStatus("plugin-stopped", pluginId);
    }
  }

  async restartPlugin(pluginId) {
    this._activationQueue = this._activationQueue.then(async () => {
      await this.stopPlugin(pluginId);

      await this.runInstalledPlugin(pluginId);
      this._currentPluginId = pluginId;
    });

    return this._activationQueue;
  }

  async switchToPlugin(pluginId) {
    this._activationQueue = this._activationQueue.then(async () => {
      if (this._currentPluginId && this._currentPluginId !== pluginId) {
        await this.stopPlugin(this._currentPluginId);
      }

      if (this._currentPluginId === pluginId) {
        await this.stopPlugin(pluginId);
      }

      await this.runInstalledPlugin(pluginId);
      this._currentPluginId = pluginId;
    });

    return this._activationQueue;
  }

  async disposeAllPlugins() {
    const ids = [...this.activePlugins.keys()];
    for (const id of ids) {
      await this.stopPlugin(id);
    }
  }

  listRunningPlugins() {
    return [...this.activePlugins.keys()];
  }

  // -------------------------------------------
  // Bridge injection
  // -------------------------------------------
  setHostBridges({ fileBridge, dolphinBridge, browserBridge }) {
    this.fileBridge = fileBridge;
    this.dolphinBridge = dolphinBridge;
    this.browserBridge = browserBridge;
  }

  // -------------------------------------------
  // Helpers
  // -------------------------------------------
  getWebContents() {
    return this.windowManager?.getWebContents?.() || null;
  }

  async ensurePluginDir() {
    await fs.mkdir(this.pluginsDir, { recursive: true });
  }

  sanitizeId(id) {
    return id.replace(/[^a-zA-Z0-9-_]/g, "_");
  }

  async findPluginEntry(distPath) {
    const candidates = ["plugin.js", "index.js", "main.js"];
    for (const name of candidates) {
      const full = path.join(distPath, name);
      try {
        await fs.access(full);
        return name;
      } catch (_) { }
    }

    const files = await fs.readdir(distPath);
    const js = files.find((f) => f.endsWith(".js"));
    if (js) return js;

    throw new Error(`No JS entrypoint found inside ${distPath}`);
  }

  async hydrateInstalledPluginContexts() {
    if (this._contextsHydrated) return;
    this._contextsHydrated = true;

    await this.ensurePluginDir();
    let dirs = [];
    try {
      dirs = await fs.readdir(this.pluginsDir);
    } catch {
      return;
    }

    for (const d of dirs) {
      const pluginFolder = path.join(this.pluginsDir, d);
      const contextPath = path.join(pluginFolder, "context.json");

      try {
        const ctx = JSON.parse(await fs.readFile(contextPath, "utf8"));
        if (ctx?.id) {
          this.installedPluginContexts.set(ctx.id, ctx);
        }
      } catch {
      }
    }
  }

  async readPluginContextFromDisk(pluginId) {
    const safeId = this.sanitizeId(pluginId);
    const pluginFolder = path.join(this.pluginsDir, safeId);
    const contextPath = path.join(pluginFolder, "context.json");
    const ctx = JSON.parse(await fs.readFile(contextPath, "utf8"));
    return ctx;
  }

  // -------------------------------------------
  // Installation
  // -------------------------------------------
  async installPlugin({ id, name, version, sha256, bytes, permissions = [], resources = [], dev = false }) {
    if (dev && !this.isDev) {
      throw new Error(`Plugin ${id} is marked as dev-only and cannot be installed in production.`);
    }

    await this.ensurePluginDir();

    const safeId = this.sanitizeId(id);
    const pluginFolder = path.join(this.pluginsDir, safeId);
    await fs.mkdir(pluginFolder, { recursive: true });

    const artifactPath = path.join(pluginFolder, "artifact.tgz");
    const buf = Buffer.from(bytes);

    const actualHash = crypto.createHash("sha256").update(buf).digest("hex");
    if (actualHash !== sha256) {
      throw new Error(`Plugin ${id} integrity check failed: expected ${sha256}, got ${actualHash}`);
    }

    await fs.writeFile(artifactPath, buf);

    const distPath = path.join(pluginFolder, "dist");
    await fs.mkdir(distPath, { recursive: true });

    await tar.x({
      file: artifactPath,
      cwd: pluginFolder,
      strict: true,
      strip: 1
    });

    const entry = await this.findPluginEntry(distPath);

    const metadata = {
      id,
      name,
      version,
      sha256,
      installedAt: new Date().toISOString(),
      entry,
      dev
    };

    await fs.writeFile(
      path.join(pluginFolder, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    const context = {
      id,
      permissions,
      resources: Object.fromEntries(resources.map((r) => [r.id, r]))
    };

    await fs.writeFile(
      path.join(pluginFolder, "context.json"),
      JSON.stringify(context, null, 2)
    );

    this.installedPluginContexts.set(id, context);

    log.info(`Plugin ${id} installed at ${pluginFolder}`);

    this.getWebContents()?.send("plugins-installed", metadata);

    return { ok: true, path: pluginFolder };
  }

  async getInstalledPluginContext(pluginId) {
    await this.hydrateInstalledPluginContexts();

    if (!this.installedPluginContexts.has(pluginId)) {
      try {
        const ctx = await this.readPluginContextFromDisk(pluginId);
        this.installedPluginContexts.set(pluginId, ctx);
      } catch { }
    }

    return this.installedPluginContexts.get(pluginId);
  }

  // -------------------------------------------
  // Listing installed plugins
  // -------------------------------------------
  async listInstalledPlugins() {
    await this.ensurePluginDir();

    const dirs = await fs.readdir(this.pluginsDir);
    const plugins = [];

    for (const d of dirs) {
      const metaPath = path.join(this.pluginsDir, d, "metadata.json");
      try {
        const meta = JSON.parse(await fs.readFile(metaPath, "utf8"));
        if (meta.dev && !this.isDev) continue;
        plugins.push(meta);
      } catch {
      }
    }

    return plugins;
  }

  // -------------------------------------------
  // Uninstall
  // -------------------------------------------
  async uninstallPlugin(pluginId) {
    await this.ensurePluginDir();

    await this.stopPlugin(pluginId);
    const safeId = this.sanitizeId(pluginId);
    const pluginFolder = path.join(this.pluginsDir, safeId);

    await fs.rm(pluginFolder, { recursive: true, force: true });

    this.installedPluginContexts.delete(pluginId);

    log.info(`Plugin ${pluginId} uninstalled`);

    this.getWebContents()?.send("plugins-uninstalled", { id: pluginId });

    return { ok: true };
  }

  // -------------------------------------------
  // Run installed plugins
  // -------------------------------------------
  async runInstalledPlugin(pluginId) {
    const safeId = this.sanitizeId(pluginId);
    const pluginFolder = path.join(this.pluginsDir, safeId);
    const metadataPath = path.join(pluginFolder, "metadata.json");

    let metadata;
    try {
      metadata = JSON.parse(await fs.readFile(metadataPath, "utf8"));
    } catch {
      throw new Error(`Plugin ${pluginId} is not installed.`);
    }

    if (metadata.dev && !this.isDev) {
      throw new Error(`Plugin ${pluginId} is dev-only and cannot run in production.`);
    }

    const entryPath = path.join(pluginFolder, "dist", metadata.entry);
    const code = await fs.readFile(entryPath, "utf8");

    const context = await this.getInstalledPluginContext(pluginId);
    return await this.loadAndRunPlugin(pluginId, code, metadata, context);
  }

  // -------------------------------------------
  // Sandbox Execution
  // -------------------------------------------
  async loadAndRunPlugin(pluginId, pluginCode, metadata = null, pluginContext = null) {
    log.info(`Activating plugin: ${pluginId}`);
    const inbound = new EventEmitter();
    const dolphinInboundChannels = new Set();
    const browserInboundChannels = new Set();
    const browserSubscriptions = new Set();
    const existing = this.activePlugins.get(pluginId);
    if (existing) {
      log.info(`Plugin ${pluginId} already active; disposing before restart`);
      try {
        await existing.onDispose?.();
      } catch (e) {
        log.warn(`Plugin ${pluginId} dispose-before-restart failed`, e);
      } finally {
        this.activePlugins.delete(pluginId);
      }
    }

    if (!metadata) metadata = { id: pluginId, name: pluginId };

    const permissions = new Set(pluginContext?.permissions || []);

    if (!this.fileBridge || !this.dolphinBridge) {
      throw new Error("Host bridges not configured. Call pluginManager.setHostBridges(...) first.");
    }

    if (!/\/\/#\s*sourceURL=/.test(pluginCode)) {
      pluginCode += `\n//# sourceURL=${pluginId}.js\n`;
    }

    const wc = this.getWebContents();
    if (!wc) throw new Error("Renderer not ready");

    const disposers = [];
    const dolphinSubscriptions = new Set();

    let disposing = false;
    let disposed = false;

    const sandboxApi = {
      log: (...args) => log.info(`[plugin:${pluginId}]`, ...args),

      stop: () => this.stopPlugin(pluginId),

      setSession: (connectCode) => {
        if (disposing || disposed) return;

        if (typeof connectCode !== "string") {
          log.warn(`[plugin:${pluginId}] setSession ignored: connectCode not a string`);
          return;
        }

        const trimmed = connectCode.trim();
        if (!trimmed) {
          log.warn(`[plugin:${pluginId}] setSession ignored: empty connectCode`);
          return;
        }

        if (trimmed.length > 32) {
          log.warn(`[plugin:${pluginId}] setSession ignored: connectCode too long`);
          return;
        }

        sandboxApi.sendEvent("setSession", trimmed);
      },

      sendEvent: (event, ...args) => {
        if (disposing && event !== "disconnect") return;

        this.pluginEvents.emit("plugin:event", {
          pluginId,
          event,
          args,
          pluginVersion: metadata?.version,
          pluginCommit: metadata?.commit,
          atUtc: new Date().toISOString(),
        });
      },
      on: (event, handler) => {
        if (disposing || disposed) return () => { };

        const listener = (...args) => {
          if (disposing) return;
          handler(...args);
        };

        inbound.on(event, listener);

        const dispose = () => inbound.off(event, listener);
        disposers.push(dispose);
        return dispose;
      },
      settings: {
        get: async (key, fallback) => this.settingsManager.get(pluginId, key, fallback),
        onChange: (handler) => sandboxApi.on("plugin:settingsChanged", (payload) => {
          if (payload?.pluginId !== pluginId) return;
          handler({ key: payload.key, value: payload.value });
        })
      },
      host: {
        file: {
          readText: (resourceId) => this.fileBridge.readText(pluginId, resourceId),
          readJson: (resourceId) => this.fileBridge.readJson(pluginId, resourceId)
        },

        launchApp: async (executablePath) => {
          if (!permissions.has("app.launch")) {
            log.warn(`[plugin:${pluginId}] launchApp denied: missing app.launch permission`);
            throw new Error("Permission denied: app.launch");
          }
          if (typeof executablePath !== "string" || !executablePath.trim()) {
            throw new Error("Invalid executable path.");
          }
          const resolved = executablePath
            .replace(/\{home\}/g, os.homedir())
            .replace(/\//g, path.sep);
          const child = spawn(resolved, [], { detached: true, stdio: "ignore" });
          child.unref();
          log.info(`[plugin:${pluginId}] launchApp:`, resolved);
        },

        dolphin: {
          subscribe: async (options) => {
            const events = options?.events || [];
            for (const ev of events) {
              dolphinSubscriptions.add(ev);
              dolphinInboundChannels.add(`dolphin:${ev}`);
            }
            return this.dolphinBridge.subscribe(pluginId, options);
          },
          unsubscribe: async (options) => {
            const events = options?.events || [];
            for (const ev of events) {
              dolphinSubscriptions.delete(ev);
              dolphinInboundChannels.delete(`dolphin:${ev}`);
            }
            return this.dolphinBridge.unsubscribe(pluginId, options);
          }
        },

        browser: {
          openWindow: (options) => {
            if (!permissions.has("bridge:browser.window")) {
              throw new Error("Permission denied: bridge:browser.window");
            }
            return this.browserBridge?.openWindow(pluginId, options);
          },
          closeWindow: () => {
            return this.browserBridge?.closeWindow(pluginId);
          },
          subscribe: async (options) => {
            const events = options?.events || [];
            for (const ev of events) {
              browserSubscriptions.add(ev);
              browserInboundChannels.add(`browser:${ev}`);
            }
            return this.browserBridge?.subscribe(pluginId, options);
          },
          unsubscribe: async (options) => {
            const events = options?.events || [];
            for (const ev of events) {
              browserSubscriptions.delete(ev);
              browserInboundChannels.delete(`browser:${ev}`);
            }
            return this.browserBridge?.unsubscribe(pluginId, options);
          },
          getTitle: () => this.browserBridge?.getTitle(pluginId) ?? null,
        }
      }
    };

    const context = {
      module: { exports: {} },
      exports: {},
      api: sandboxApi,
      plugin: metadata,
      URL,
      URLSearchParams,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      queueMicrotask,
      console: {
        log: (...a) => log.info(`[plugin:${pluginId}]`, ...a),
        warn: (...a) => log.warn(`[plugin:${pluginId}]`, ...a),
        error: (...a) => log.error(`[plugin:${pluginId}]`, ...a),
        info: (...a) => log.info(`[plugin:${pluginId}]`, ...a),
      },
    };
    context.global = context;

    const vmContext = vm.createContext(context);

    const script = new vm.Script(pluginCode, {
      filename: `${pluginId}.js`,
      displayErrors: true
    });

    try {
      script.runInContext(vmContext, { displayErrors: true });

      const pluginExport = context.module.exports;

      if (!pluginExport || typeof pluginExport.onInit !== "function") {
        log.warn(`Plugin ${pluginId} has no onInit export; skipping activation`);
        return;
      }

      let disposing = false;
      let disposed = false;

      const dispose = async () => {
        if (disposed || disposing) return;
        disposing = true;

        try {
          if (dolphinSubscriptions.size) {
            await sandboxApi.host.dolphin.unsubscribe({ events: [...dolphinSubscriptions] });
          }
        } catch (e) {
          log.warn(`Plugin ${pluginId} dolphin.unsubscribe failed`, e);
        }

        try {
          if (browserSubscriptions.size) {
            await sandboxApi.host.browser.unsubscribe({ events: [...browserSubscriptions] });
          }
        } catch (e) {
          log.warn(`Plugin ${pluginId} youtube.unsubscribe failed`, e);
        }

        try {
          for (const d of disposers.splice(0)) {
            try { d(); } catch (e) { log.warn(`Plugin ${pluginId} disposer failed`, e); }
          }
        } finally {
          try {
            if (typeof pluginExport?.onDispose === "function") {
              await pluginExport.onDispose();
            }
          } catch (e) {
            log.warn(`Plugin ${pluginId} onDispose failed`, e);
          } finally {
            disposed = true;
          }
        }
      };

      const activeEntry = {
        id: pluginId,
        inbound,
        dolphinInboundChannels,
        browserInboundChannels,
        startedAt: new Date(),
        get isDisposing() { return disposing; },
        get isDisposed() { return disposed; },
        onDispose: dispose
      };

      this.activePlugins.set(pluginId, activeEntry);
      try {
        await pluginExport.onInit(sandboxApi);

        log.info(`Plugin ${pluginId} activated`);

        this._emitPluginStatus("plugin-started", pluginId);
      } catch (err) {
        log.error(`Plugin ${pluginId} onInit failed`, err);

        try {
          await activeEntry.onDispose?.();
        } catch (e) {
          log.warn(`dispose after init failure failed for ${pluginId}`, e);
        } finally {
          this.activePlugins.delete(pluginId);
          if (this._currentPluginId === pluginId) this._currentPluginId = null;
          this._emitPluginStatus("plugin-stopped", pluginId);
        }

        throw err;
      }
    } catch (err) {
      log.error(`Plugin ${pluginId} failed to activate`, err);
    }
  }
  _emitPluginStatus(event, pluginId) {
    try {
      this.getWebContents()?.send(event, { pluginId });
    } catch (e) {
      log.warn(`[PluginManager] failed to send ${event} for ${pluginId}`, e);
    }
  }
  _wireGlobalRoutingOnce() {
    if (this._globalRoutingWired) return;
    this._globalRoutingWired = true;

    this.pluginEvents.on("dolphin:event", (msg) => {
      const name = msg?.name;
      const payload = msg?.payload;

      if (!name) return;

      const channel = `dolphin:${name}`;

      for (const active of this.activePlugins.values()) {
        if (active?.dolphinInboundChannels?.has(channel)) {
          active.inbound.emit(channel, payload);
        }
      }
    });

    this.pluginEvents.on("browser:event", (msg) => {
      const name = msg?.name;
      const payload = msg?.payload;
      if (!name) return;
      const channel = `browser:${name}`;
      for (const active of this.activePlugins.values()) {
        if (active?.browserInboundChannels?.has(channel)) {
          active.inbound.emit(channel, payload);
        }
      }
    });

    this.pluginEvents.on("plugin:settingsChanged", (msg) => {
      const active = this.activePlugins.get(msg?.pluginId);
      if (!active?.inbound) return;
      active.inbound.emit("plugin:settingsChanged", msg);
    });
  }
}

module.exports = PluginManager;
