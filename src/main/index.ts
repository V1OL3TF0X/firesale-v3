import { app, BrowserWindow, dialog, ipcMain, shell, Menu, MenuItemConstructorOptions } from "electron";
import { join, basename } from "path";
import { readFile, writeFile } from "fs/promises";

type MarkdownFile = {
  content: string;
  filePath?: string;
};

let currentFiles: Map<BrowserWindow, MarkdownFile> = new Map();

function title(filename: string) {
  return `${app.name} - ${filename}`;
}

function setCurrentFile(window: BrowserWindow, newFile: MarkdownFile) {
  currentFiles.set(window, newFile);

  if (!newFile.filePath) {
    window.setTitle(title("untitled.md"));
    window.setRepresentedFilename('');
    return;
  }
  app.addRecentDocument(newFile.filePath);
  window.setTitle(title(basename(newFile.filePath)));
  window.setRepresentedFilename(newFile.filePath);
}

const hasChanges = (window: BrowserWindow, contents: string) => {
  const file = currentFiles.get(window);
    if(!file) return !!contents;
    return file.content !== contents;
};

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });
  mainWindow.webContents.openDevTools({
    mode: "detach",
  });
  mainWindow.on("closed", () => currentFiles.delete(mainWindow));
    return mainWindow;
};
app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

const openFile = async (browserWindow: BrowserWindow, filePath: string) => {
  const content = await readFile(filePath, { encoding: "utf-8" });
  setCurrentFile(browserWindow, { content, filePath });
  browserWindow.webContents.send("file-opened", content, filePath);
};

async function saveFile(
  window: BrowserWindow,
  filePath: string,
  contents: string,
) {
  try {
    await writeFile(filePath, contents, { encoding: "utf-8" });
    window.webContents.send("file-saved", filePath);
  } catch (e) {
    window.webContents.send("save-file-error", e);
  }
}

const showOpenDialog = async (window: BrowserWindow) => {
  const result = await dialog.showOpenDialog(window, {
    properties: ["openFile"],
    filters: [{ name: "Markdown File", extensions: ["md"] }],
  });
  if (result.canceled) return;
  const [fp] = result.filePaths;
  openFile(window, fp);
};

const showSaveDialog = async (
  window: BrowserWindow,
  opts: Electron.SaveDialogOptions,
) => {
  const result = await dialog.showSaveDialog(window, opts);
  if (result.canceled) {
    window.webContents.send("save-file-canceled");
    return;
  }
  return result.filePath;
};

const saveCurrentFile = async (window: BrowserWindow, contents: string, forceDialog = false) => {
  let currentFile = currentFiles.get(window);
  if (!currentFile || forceDialog) {
    const filePath = await showSaveDialog(window, {
      title: "Save markdown to file",
      defaultPath: currentFile?.filePath ?? "untitled.md",
      filters: [{ name: "Markdown File", extensions: ["md"] }],
    });
    if (!filePath) return;
        currentFile = { filePath, content: contents};
    setCurrentFile(window, currentFile);
  } else {
    if (currentFile.content === contents) return;
    currentFile.content = contents;
  }
  saveFile(window, currentFile.filePath!, currentFile.content);
};

ipcMain.on("show-save-dialog", async (evt, contents: string) => {
  const window = BrowserWindow.fromWebContents(evt.sender);
  if (!window) return;
  const filePath = await showSaveDialog(window, {
    title: "Save HTML to file",
    defaultPath: "rendered_html.html",
    filters: [{ name: "HTML File", extensions: ["html"] }],
  });
  if (!filePath) return;
  saveFile(window, filePath, contents);
});
ipcMain.on("open-new-file", (evt) => {
  const window = BrowserWindow.fromWebContents(evt.sender);
  if (!window) return;
  setCurrentFile(window, { content: "", filePath: undefined });
});
ipcMain.on("show-open-dialog", (evt) => {
  const window = BrowserWindow.fromWebContents(evt.sender);
  if (!window) return;
  showOpenDialog(window);
});

ipcMain.on("save-file", (evt, contents, force) => {
  const window = BrowserWindow.fromWebContents(evt.sender);
  if (!window) return;
  saveCurrentFile(window, contents, force);
});
ipcMain.handle("revert-changes", (evt) => {
  const window = BrowserWindow.fromWebContents(evt.sender);
  if (!window) return;
  return currentFiles.get(window)?.content;
});

ipcMain.handle("has-changes", (evt, contents) => {
  const window = BrowserWindow.fromWebContents(evt.sender);
  if (!window) return false;
  const changed = hasChanges(window, contents);
  window.setDocumentEdited(changed);
  const menu = Menu.getApplicationMenu()!;
  menu.getMenuItemById('save')!.enabled = changed;
  menu.getMenuItemById('save-as')!.enabled = changed;
  return changed;
});

ipcMain.on("open-in-default-app", (e) => {
  const window = BrowserWindow.fromWebContents(e.sender);
  if (!window) return;
  const file = currentFiles.get(window);
  if (!file?.filePath) {
    window.webContents.send("has-file-path", false);
  }
  shell.openPath(file!.filePath!);
});

ipcMain.on("open-in-folder", (e) => {
  const window = BrowserWindow.fromWebContents(e.sender);
  if (!window) return;
  const file = currentFiles.get(window);
  if (!file?.filePath) {
    window.webContents.send("has-file-path", false);
  }
  shell.showItemInFolder(file!.filePath!);
});

const template: MenuItemConstructorOptions[] = [
    {
        label: 'File',
        submenu: [
            {
                label: 'Open',
                click() {
                    const currentWindow = BrowserWindow.getFocusedWindow() ?? createWindow();
                    showOpenDialog(currentWindow);
                },
                accelerator: 'CmdOrCtrl + O',
            },
            {
                label: 'Save',
                id: 'save',
                click() {
                    (BrowserWindow.getFocusedWindow() ?? createWindow())
                        .webContents
                        .send('save-to-file', false);
                },
                accelerator: 'CmdOrCtrl + S',
            },
            {
                id: 'save-as',
                label: 'Save As',
                click() {
                    (BrowserWindow.getFocusedWindow() ?? createWindow())
                        .webContents
                        .send('save-to-file', true);
                },
                accelerator: 'CmdOrCtrl + Shift + S',
            },
        ],
    },
    {
        label: 'Edit',
        role: 'editMenu',
    },
];

if (process.platform === 'darwin') {
    template.unshift({
        label: app.name,
        role: 'appMenu',
    });
}
const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
