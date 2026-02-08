const fs = require("fs/promises");
const path = require("path");
const os = require("os");

function resolveResourcePath(resource) {
  if (!resource?.path) throw new Error("Resource missing path");

  const vars = {
    "{home}": os.homedir(),
    "{appData}": path.join(os.homedir(), "AppData", "Roaming")
  };

  let resolved = resource.path;
  for (const [key, value] of Object.entries(vars)) {
    resolved = resolved.replaceAll(key, value);
  }

  resolved = path.resolve(resolved);

  const home = path.resolve(os.homedir());
  if (!resolved.toLowerCase().startsWith(home.toLowerCase())) {
    throw new Error("Denied: path outside allowed directory");
  }

  return resolved;
}

async function readFileLimited(fullPath, maxBytes = 64 * 1024) {
  const buf = await fs.readFile(fullPath);
  if (buf.length > maxBytes) {
    throw new Error("Denied: file exceeds size limit");
  }
  return buf.toString("utf8");
}

async function authorizeAndResolve({ getPluginContext, pluginId, resourceId, requireJson }) {
  const ctx = await getPluginContext(pluginId);
  if (!ctx) throw new Error(`Unknown plugin: ${pluginId}`);

  if (!ctx.permissions?.includes("file.read")) {
    throw new Error("Denied: missing permission file.read");
  }

  const resource = ctx.resources?.[resourceId];
  if (!resource) throw new Error(`Unknown resource: ${resourceId}`);

  if (requireJson && resource.type !== "json") {
    throw new Error("Denied: resource is not json");
  }

  const fullPath = resolveResourcePath(resource);
  return { fullPath, resource };
}

function registerFileBridge({ ipcMain, getPluginContext }) {
  const api = {
    async readText(pluginId, resourceId) {
      const { fullPath } = await authorizeAndResolve({
        getPluginContext,
        pluginId,
        resourceId,
        requireJson: false
      });
      return await readFileLimited(fullPath);
    },

    async readJson(pluginId, resourceId) {
      const { fullPath } = await authorizeAndResolve({
        getPluginContext,
        pluginId,
        resourceId,
        requireJson: true
      });
      const text = await readFileLimited(fullPath);
      return JSON.parse(text);
    }
  };

  if (ipcMain) {
    ipcMain.handle("bridge:file.readText", async (_evt, { pluginId, resourceId }) => {
      return api.readText(pluginId, resourceId);
    });

    ipcMain.handle("bridge:file.readJson", async (_evt, { pluginId, resourceId }) => {
      return api.readJson(pluginId, resourceId);
    });
  }

  return api;
}

module.exports = registerFileBridge;
