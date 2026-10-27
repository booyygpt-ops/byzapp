const { app, BrowserWindow, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
let backend;
let quitting = false;
app.setName('Byz Workspace');
app.whenReady().then(async () => {
  try {
    const { startServer } = await import(pathToFileURL(path.join(__dirname, '../server/index.js')).href);
    backend = await startServer({ dataDir: path.join(app.getPath('userData'), 'workspace'), runtimeDir: app.isPackaged ? path.join(process.resourcesPath, 'runtime') : path.join(__dirname, '../runtime') });
    const createWindow = () => {
      const win = new BrowserWindow({ width: 1440, height: 940, minWidth: 1020, minHeight: 700, title: 'Byz Workspace', backgroundColor: '#f6f7f3', autoHideMenuBar: true, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webviewTag: false } });
      win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      win.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== backend.url) event.preventDefault(); });
      win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
      win.webContents.session.on('will-download', event => event.preventDefault());
      win.loadURL(backend.url);
    };
    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  } catch (error) { dialog.showErrorBox('Byz başlatılamadı', error.message); app.quit(); }
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', event => { if (backend && !quitting) { event.preventDefault(); quitting = true; backend.close().finally(() => app.quit()); } });
