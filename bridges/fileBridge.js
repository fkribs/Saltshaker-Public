const fs = require("fs/promises");
const path = require("path");
const os = require("os");

function getResourcePathForPlatform(resource) {
  const platform = process.platform;

  if (platform === "darwin") {
    return resource.macPath || resource.path;
  }

  if (platform === "win32") {
    return resource.winPath || resource.path;
  }

  if (platform === "linux") {
    return resource.linuxPath || resource.path;
  }

  return resource.path;
}

function isSubPath(parent, child) {
  const relative = path.relative(parent, child);
  return (
    (relative &&
      !relative.startsWith("..") &&
      !path.isAbsolute(relative)) ||
    relative === ""
  );
}

function resolveResourcePath(resource) {
  const rawPath = getResourcePathForPlatform(resource);
  if (!rawPath) throw new Error("Resource missing path");

  const home = path.resolve(os.homedir());

  let appData;
  switch (process.platform) {
    case "darwin":
      appData = path.join(home, "Library", "Application Support");
      break;
    case "linux":
      appData = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
      break;
    default:
      appData = path.join(home, "AppData", "Roaming");
      break;
  }

  const vars = {
    "{home}": home,
    "{appData}": appData
  };

  let resolved = rawPath;
  for (const [key, value] of Object.entries(vars)) {
    resolved = resolved.replaceAll(key, value);
  }

  resolved = path.resolve(resolved);

  if (!isSubPath(home, resolved)) {
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
