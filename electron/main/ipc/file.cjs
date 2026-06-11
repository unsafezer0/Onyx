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
    const data = await fs.promises.readFile(filePath);
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
      await fs.promises.writeFile(filePath, buffer);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle(ipcChannels.FILE_SAVE_AS, async () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];

    const { app } = require("electron");
    const defaultName = Date.now().toString().slice(-5) + ".png";
    const defaultPath = path.join(app.getPath("documents"), defaultName);

    const result = await dialog.showSaveDialog(win, {
      title: "Save Image As",
      defaultPath: defaultPath,
      filters: [
        { name: "PNG", extensions: ["png"] },
        { name: "JPEG", extensions: ["jpg", "jpeg"] },
        { name: "WebP", extensions: ["webp"] },
      ],
    });

    if (result.canceled || !result.filePath) return null;

    return {
      filePath: result.filePath,
      fileName: path.basename(result.filePath),
    };
  });

  ipcMain.handle(ipcChannels.FILE_OPEN_URL, async (_event, url) => {
    if (!url || typeof url !== "string") {
      return { error: "No URL provided." };
    }

    try {
      const parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return { error: "Only HTTP and HTTPS URLs are supported." };
      }

      const mod = parsedUrl.protocol === "https:" ? require("https") : require("http");

      const data = await new Promise((resolve, reject) => {
        const req = mod.get(url, { timeout: 30000 }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            // Follow one redirect
            mod.get(res.headers.location, { timeout: 30000 }, (res2) => {
              handleResponse(res2, resolve, reject);
            }).on("error", reject);
            return;
          }
          handleResponse(res, resolve, reject);
        });
        req.on("error", reject);
        req.on("timeout", () => {
          req.destroy();
          reject(new Error("Request timed out."));
        });
      });

      return data;
    } catch (err) {
      return { error: err.message || "Failed to fetch image from URL." };
    }
  });

  function handleResponse(res, resolve, reject) {
    if (res.statusCode !== 200) {
      res.resume();
      return reject(new Error(`Server returned status ${res.statusCode}.`));
    }

    const contentType = (res.headers["content-type"] || "").split(";")[0].trim();
    if (!contentType.startsWith("image/")) {
      res.resume();
      return reject(new Error(`URL did not return an image (got ${contentType}).`));
    }

    const chunks = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => {
      const buffer = Buffer.concat(chunks);
      const base64 = buffer.toString("base64");

      // Derive a filename from the URL path
      let fileName = "image.png";
      try {
        const pathname = new URL(res.responseUrl || "").pathname;
        const basename = path.basename(pathname);
        if (basename && basename.includes(".")) {
          fileName = basename;
        }
      } catch {
        // keep default
      }

      resolve({
        dataUrl: `data:${contentType};base64,${base64}`,
        filePath: null,
        fileName,
      });
    });
    res.on("error", reject);
  }
}

module.exports = { registerFileIpc };
