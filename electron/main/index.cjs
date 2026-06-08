const { app, BrowserWindow, Menu } = require("electron");
const { createWindow } = require("./window.cjs");
const { registerAppIpc } = require("./ipc/app.cjs");
const { registerFileIpc } = require("./ipc/file.cjs");
const { ipcChannels } = require("../constants.cjs");

function sendToRenderer(channel, ...args) {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.webContents.send(channel, ...args);
  }
}

const template = [
  {
    label: "File",
    submenu: [
      {
        label: "Open Image",
        accelerator: "CmdOrCtrl+O",
        click: () => sendToRenderer(ipcChannels.MENU_EVENT, "open"),
      },
      { type: "separator" },
      {
        label: "Save",
        accelerator: "CmdOrCtrl+S",
        click: () => sendToRenderer(ipcChannels.MENU_EVENT, "save"),
      },
      {
        label: "Save As...",
        accelerator: "CmdOrCtrl+Shift+S",
        click: () => sendToRenderer(ipcChannels.MENU_EVENT, "save-as"),
      },
      { type: "separator" },
      {
        label: "Export",
        accelerator: "CmdOrCtrl+E",
        click: () => sendToRenderer(ipcChannels.MENU_EVENT, "export"),
      },
      { type: "separator" },
      { label: "Exit", role: "quit" },
    ],
  },
  {
    label: "Edit",
    submenu: [
      {
        label: "Undo",
        accelerator: "CmdOrCtrl+Z",
        click: () => sendToRenderer(ipcChannels.MENU_EVENT, "undo"),
      },
      {
        label: "Redo",
        accelerator: "CmdOrCtrl+Shift+Z",
        click: () => sendToRenderer(ipcChannels.MENU_EVENT, "redo"),
      },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  },
  {
    label: "View",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { type: "separator" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  },
];

Menu.setApplicationMenu(Menu.buildFromTemplate(template));

app.whenReady().then(() => {
  registerAppIpc();
  registerFileIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
