/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const { dialog } = require('electron');

const waitForServer = (url, timeout = 30000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        reject(new Error('Timeout waiting for server'));
      }
      const req = http.get(url, () => {
        clearInterval(interval);
        resolve();
      });
      req.on('error', () => {
        // Connection refused, server not up yet
      });
    }, 500);
  });
};

let mainWindow;
let nextProcess;

function getDesktopServerEnv(port) {
  const required = ['DATABASE_URL', 'AUTH_SECRET'];
  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(', ')}. Configure the same Neon DATABASE_URL and AUTH_SECRET used by the web deployment before launching Garage ERP.`
    );
  }

  return {
    ...process.env,
    NODE_ENV: 'production',
    PORT: port.toString(),
    HOSTNAME: '127.0.0.1',
    ELECTRON_RUN_AS_NODE: '1',
    ELECTRON_DESKTOP: '1',
  };
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  const isDev = !app.isPackaged;
  const port = isDev ? 3000 : 3001; // Use 3001 for prod so it doesn't conflict if dev is running
  const url = `http://localhost:${port}`;

  const handleLogoutNavigation = (event, targetUrl) => {
    if (targetUrl.includes('/api/auth/logout') || targetUrl.includes('/api/auth/force-logout') || targetUrl.includes('/api/auth/signout')) {
      event.preventDefault();
      console.log('Intercepted logout navigation in Electron main process, clearing storage...');
      const ses = mainWindow.webContents.session;
      ses.clearStorageData({
        storages: ['cookies', 'localstorage', 'indexdb', 'websql', 'serviceworkers', 'cachestorage']
      }).then(() => {
        console.log('Storage cleared successfully. Redirecting to login...');
        mainWindow.loadURL(`${url}/login`);
      }).catch(err => {
        console.error('Failed to clear storage:', err);
        mainWindow.loadURL(`${url}/login`);
      });
    }
  };

  mainWindow.webContents.on('will-navigate', handleLogoutNavigation);
  mainWindow.webContents.on('will-redirect', handleLogoutNavigation);

  if (isDev) {
    // In dev mode, wait for Next.js dev server
    try {
      await waitForServer(url, 30000);
      mainWindow.loadURL(url);
    } catch (err) {
      console.error('Dev server timeout', err);
    }
  } else {
    // The packaged app runs the same Next.js server as the website. It reads
    // DATABASE_URL at runtime and never creates or uses a local database.
    const serverPath = path.join(__dirname, '.next', 'standalone', 'server.js');

    let env;
    try {
      env = getDesktopServerEnv(port);
    } catch (error) {
      dialog.showErrorBox('Garage ERP configuration required', error.message);
      app.quit();
      return;
    }

    nextProcess = spawn(process.execPath, [serverPath], { env, cwd: path.dirname(serverPath) });

    nextProcess.stdout.on('data', (data) => console.log(`Next.js: ${data}`));
    nextProcess.stderr.on('data', (data) => console.error(`Next.js Error: ${data}`));

    // Wait for the Next.js server to be ready before loading the URL
    try {
      await waitForServer(url, 30000);
      mainWindow.loadURL(url);
    } catch (error) {
      console.error('Next.js server failed to start:', error);
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (nextProcess) {
    nextProcess.kill();
  }
});
