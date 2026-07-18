const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const waitOn = require('wait-on');

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

  if (isDev) {
    // In dev mode, wait for Next.js dev server
    try {
      await waitOn({ resources: [url], timeout: 30000 });
      mainWindow.loadURL(url);
    } catch (err) {
      console.error('Dev server timeout', err);
    }
  } else {
    // In production, Next.js standalone server is run
    const serverPath = path.join(__dirname, '.next', 'standalone', 'server.js');
    
    // Set environment variables for Next.js standalone
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: port.toString(),
      HOSTNAME: 'localhost'
    };

    nextProcess = spawn(process.execPath, [serverPath], { env });

    nextProcess.stdout.on('data', (data) => console.log(`Next.js: ${data}`));
    nextProcess.stderr.on('data', (data) => console.error(`Next.js Error: ${data}`));

    // Wait for the Next.js server to be ready before loading the URL
    try {
      await waitOn({ resources: [url], timeout: 30000 });
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
