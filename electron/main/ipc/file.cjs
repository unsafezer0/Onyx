const { ipcMain, dialog, BrowserWindow } = require("electron");
const { ipcChannels } = require("../../constants.cjs");
const fs = require("fs");
const path = require("path");

function registerFileIpc() {
  ipcMain.handle(ipcChannels.FILE_OPEN, async () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];

    const result = await dialog.showOpenDialog(win, {
      title: "Open Image",
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"],
        },
      ],
      properties: ["openFile"],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const ext = path.extname(filePath).toLowerCase().replace(".", "");
    const mimeMap = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      bmp: "image/bmp",
      gif: "image/gif",
    };
    const mime = mimeMap[ext] || "image/png";
    const data = fs.readFileSync(filePath);
    const base64 = data.toString("base64");

    return {
      dataUrl: `data:${mime};base64,${base64}`,
      filePath,
      fileName: path.basename(filePath),
    };
  });

  ipcMain.handle(ipcChannels.FILE_SAVE, async (_event, { dataUrl, filePath }) => {
    if (!filePath || !dataUrl) return false;

    try {
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      fs.writeFileSync(filePath, buffer);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle(ipcChannels.FILE_SAVE_AS, async (_event, { dataUrl }) => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (!dataUrl) return null;

    const result = await dialog.showSaveDialog(win, {
      title: "Save Image As",
      filters: [
        { name: "PNG", extensions: ["png"] },
        { name: "JPEG", extensions: ["jpg", "jpeg"] },
        { name: "WebP", extensions: ["webp"] },
      ],
    });

    if (result.canceled || !result.filePath) return null;

    try {
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      fs.writeFileSync(result.filePath, buffer);
      return {
        filePath: result.filePath,
        fileName: path.basename(result.filePath),
      };
    } catch {
      return null;
    }
  });
}

module.exports = { registerFileIpc };
