const { contextBridge, ipcRenderer } = require("electron");

const ipcChannels = {
  APP_VERSION: "app:version",
  FILE_OPEN: "file:open",
  FILE_OPEN_URL: "file:open-url",
  FILE_SAVE: "file:save",
  FILE_SAVE_AS: "file:save-as",
  MENU_EVENT: "menu:event",
};

contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: () => ipcRenderer.invoke(ipcChannels.APP_VERSION),

  openFile: () => ipcRenderer.invoke(ipcChannels.FILE_OPEN),
  openFileFromUrl: (url) =>
    ipcRenderer.invoke(ipcChannels.FILE_OPEN_URL, url),
  saveFile: (dataUrl, filePath) =>
    ipcRenderer.invoke(ipcChannels.FILE_SAVE, { dataUrl, filePath }),
  /** Shows save-as dialog only, returns { filePath, fileName } or null. */
  saveFileAs: () => ipcRenderer.invoke(ipcChannels.FILE_SAVE_AS),

  onMenuEvent: (callback) => {
    const listener = (_event, action) => callback(action);
    ipcRenderer.on(ipcChannels.MENU_EVENT, listener);
    return () => ipcRenderer.removeListener(ipcChannels.MENU_EVENT, listener);
  },

  send: (channel, ...args) => {
    const allowed = ["example-channel"];
    if (allowed.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },

  on: (channel, callback) => {
    const allowed = ["example-channel"];
    if (allowed.includes(channel)) {
      const listener = (_event, ...args) => callback(...args);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    }
    return () => {};
  },
});
