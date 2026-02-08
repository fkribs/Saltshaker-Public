const { BrowserWindow, app, shell } = require('electron');
const path = require('path');

class WindowManager {
  constructor() {
    this.window = null;
  }

  createWindow() {
    const isDev = !app.isPackaged;

    const iconPath = process.platform === 'win32'
      ? path.join(__dirname, 'build', 'icon.ico')
      : path.join(__dirname, 'src', 'assets', 'icon.png');

    this.window = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      backgroundColor: '#ffffff',
      icon: iconPath,
      title: 'Salt Shaker',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });

    const allowedOrigins = new Set([
      'https://signalrcorewebrtc20240210154024-cbhbe3c2c7a0a4hr.canadacentral-01.azurewebsites.net',
      'http://localhost:7287',
      'https://localhost:7287',
      'https://saltshaker.app'
    ]);

    this.window.once('ready-to-show', () => {
      this.window.show();
    });
    const isAllowedUrl = (url) => {
      try {
        const u = new URL(url);
        const origin = `${u.protocol}//${u.host}`;
        return allowedOrigins.has(origin);
      } catch {
        return false;
      }
    };
    this.window.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    this.window.webContents.on('will-navigate', (event, url) => {
      if (!isAllowedUrl(url)) {
        event.preventDefault();
        shell.openExternal(url);
      }
    });

    this.window.webContents.on('will-redirect', (event, url) => {
      if (!isAllowedUrl(url)) {
        event.preventDefault();
        shell.openExternal(url);
      }
    });

    //this.window.loadURL('https://localhost:7287/portal');
    this.window.loadURL('https://saltshaker.app/portal');

    if (isDev) {
      this.window.webContents.openDevTools({ mode: 'detach' });
    }

    this.window.on('closed', () => {
      this.window = null;
    });
  }

  getWebContents() {
    return this.window ? this.window.webContents : null;
  }

}

module.exports = WindowManager;
