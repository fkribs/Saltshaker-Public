const { app, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

class UpdateManager {
  constructor() {
    autoUpdater.logger = log;
    log.transports.file.level = "info";

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("error", (err) => log.error("[updater] error", err));
    autoUpdater.on("update-available", () => log.info("[updater] update-available"));
    autoUpdater.on("update-not-available", () => log.info("[updater] update-not-available"));
    autoUpdater.on("download-progress", (p) =>
      log.info("[updater] download-progress", Math.round(p.percent) + "%")
    );

    autoUpdater.on("update-downloaded", async (info) => {
      log.info("[updater] update-downloaded", info);

      if (!app.isPackaged) return;

      const result = await dialog.showMessageBox({
        type: "info",
        buttons: ["Restart now", "Later"],
        defaultId: 0,
        cancelId: 1,
        title: "Update ready",
        message: `SaltShaker ${info?.version ?? "update"} is ready to install.`,
        detail: "Restart SaltShaker to apply the update.",
        noLink: true,
      });

      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  }

  async checkForUpdates() {
    if (!app.isPackaged) {
      log.info("[updater] skip: app not packaged");
      return;
    }
    try {
      await autoUpdater.checkForUpdates();
    } catch (e) {
      log.error("[updater] checkForUpdates threw", e);
    }
  }
}

module.exports = UpdateManager;
