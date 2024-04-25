import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { join, basename } from "path";
import { readFile, writeFile } from "fs/promises";

type MarkdownFile = {
  content: string;
  filePath: string;
};

let currentFiles: Map<BrowserWindow, MarkdownFile> = new Map();

function setCurrentFile(window: BrowserWindow, newFile: MarkdownFile) {
  currentFiles.set(window, newFile);

  app.addRecentDocument(newFile.filePath);
  window.setTitle(`${app.name} - ${basename(newFile.filePath)}`);
  window.setRepresentedFilename(newFile.filePath);
}

const hasChanges = (window: BrowserWindow, contents: string) => {
  return currentFiles.get(window)?.content !== contents;
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

const saveCurrentFile = async (window: BrowserWindow, contents: string) => {
  let currentFile = currentFiles.get(window);
  if (!currentFile) {
    const filePath = await showSaveDialog(window, {
      title: "Save markdown to file",
      defaultPath: "untitled.md",
      filters: [{ name: "Markdown File", extensions: ["md"] }],
    });
    if (!filePath) return;
    currentFile = { filePath, content: contents };
    setCurrentFile(window, currentFile);
  } else {
    if (currentFile.content === contents) return;
    currentFile.content = contents;
  }
  saveFile(window, currentFile.filePath, contents);
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

ipcMain.on("show-open-dialog", (evt) => {
  const window = BrowserWindow.fromWebContents(evt.sender);
  if (!window) return;
  showOpenDialog(window);
});

ipcMain.on("save-file", (evt, contents) => {
  const window = BrowserWindow.fromWebContents(evt.sender);
  if (!window) return;
  saveCurrentFile(window, contents);
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
  return changed;
});
