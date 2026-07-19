const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

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
    // Persistent database setup
    const dbPath = path.join(app.getPath('userData'), 'database.db');
    if (!fs.existsSync(dbPath)) {
      const sourceDb = path.join(__dirname, 'prisma', 'dev.db');
      if (fs.existsSync(sourceDb)) {
        fs.copyFileSync(sourceDb, dbPath);
      }
    }

    // In production, Next.js standalone server is run
    const serverPath = path.join(__dirname, '.next', 'standalone', 'server.js');
    
    // Set environment variables for Next.js standalone
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: port.toString(),
      HOSTNAME: 'localhost',
      ELECTRON_RUN_AS_NODE: '1',
      DATABASE_URL: `file:${dbPath}`
    };

    nextProcess = spawn(process.execPath, [serverPath], { env });

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
