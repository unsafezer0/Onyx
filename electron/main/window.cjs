const { BrowserWindow } = require("electron");
const path = require("path");

const isDev = !require("electron").app.isPackaged;

function createWindow() {
  const iconPath = isDev
    ? path.join(__dirname, "..", "..", "public", "icon.png")
    : path.join(process.resourcesPath, "icon.png");

  const win = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 1024,
    minHeight: 600,
    title: "Onyx",
    icon: iconPath,

    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    autoHideMenuBar: true,
  });

  win.removeMenu();

  require("electron").session.defaultSession.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            isDev
              ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://localhost:*"
              : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:",
          ],
        },
      });
    },
  );

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "..", "..", "dist", "index.html"));
  }

  return win;
}

module.exports = { createWindow };
