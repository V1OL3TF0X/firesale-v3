import { ipcRenderer, contextBridge } from "electron";

const stripEvt =
  <Args extends unknown[]>(cb: (...args: Args) => void) =>
  (_: Electron.IpcRendererEvent, ...args: Args) =>
    cb(...args);

const key = "api" as const;
const fns = {
  onSaveFileError(cb: (e: Error) => void) {
    ipcRenderer.on("save-file-error", stripEvt(cb));
  },
  onFileOpened(cb: (contents: string) => void) {
    ipcRenderer.on("file-opened", stripEvt(cb));
  },
  onFileSaved(cb: (filePath: string) => void) {
    ipcRenderer.on("file-saved", stripEvt(cb));
  },
  showOpenDialog() {
    ipcRenderer.send("show-open-dialog");
  },
  showSaveDialog(contents: string) {
    ipcRenderer.send("show-save-dialog", contents);
  },
  saveFile(content: string) {
    ipcRenderer.send("save-file", content);
  },
} as const;

export type ExtraFunctions = {
  [K in typeof key]: typeof fns;
};

contextBridge.exposeInMainWorld(key, fns);
