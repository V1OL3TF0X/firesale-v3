import { app, BrowserWindow, dialog } from 'electron';
import { join } from 'path';
import {readFile } from 'fs/promises';

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    showOpenDialog(mainWindow);
  })

  mainWindow.webContents.openDevTools({
    mode: 'detach',
  });
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

const openFile = async (filePath: string) => {
    return await readFile(filePath, { encoding: 'utf-8' });
}
const showOpenDialog = async (window: BrowserWindow ) => {
    const result = await dialog.showOpenDialog(window, {
        properties: ['openFile'],
        filters: [{ name: 'Markdown File', extensions: ['md'] }]
    })
    if (result.canceled) return;
    const [fp] = result.filePaths;
    console.log(openFile(fp));
}

