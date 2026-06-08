const { app, ipcMain } = require("electron");
const { ipcChannels } = require("../../constants.cjs");

function registerAppIpc() {
  ipcMain.handle(ipcChannels.APP_VERSION, () => app.getVersion());
}

module.exports = { registerAppIpc };
