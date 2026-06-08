export interface FileOpenResult {
  dataUrl: string;
  filePath: string;
  fileName: string;
}

export interface FileSaveResult {
  filePath: string;
  fileName: string;
}

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  openFile: () => Promise<FileOpenResult | null>;
  saveFile: (dataUrl: string, filePath: string) => Promise<boolean>;
  saveFileAs: (dataUrl: string) => Promise<FileSaveResult | null>;
  onMenuEvent: (callback: (action: string) => void) => () => void;
  send: (channel: string, ...args: unknown[]) => void;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
