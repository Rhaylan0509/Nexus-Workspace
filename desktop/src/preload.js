const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('xournal', {
  status: () => ipcRenderer.invoke('app:status'),
  syncGitHub: () => ipcRenderer.invoke('app:github-sync'),
  gitHubStatus: () => ipcRenderer.invoke('app:github-status'),
  syncGoogleDrive: () => ipcRenderer.invoke('app:github-sync'),
  googleDriveStatus: () => ipcRenderer.invoke('app:github-status'),
  disconnectGoogleDrive: () => ipcRenderer.invoke('app:drive-disconnect'),
  chooseExecutable: () => ipcRenderer.invoke('app:choose-executable'),
  openFile: () => ipcRenderer.invoke('app:open-file'),
  newNote: () => ipcRenderer.invoke('app:new-note'),
  openRecent: (file) => ipcRenderer.invoke('app:open-recent', file),
  revealFile: (file) => ipcRenderer.invoke('app:reveal-file', file),
  getLibrary: () => ipcRenderer.invoke('library:get'),
  chooseLibraryFiles: () => ipcRenderer.invoke('library:choose-file'),
  importLibraryFile: (data) => ipcRenderer.invoke('library:import-file', data),
  createLibraryEntry: (data) => ipcRenderer.invoke('library:create-entry', data),
  openLibraryNote: (id) => ipcRenderer.invoke('library:open-note', id),
  renameLibraryEntry: (data) => ipcRenderer.invoke('library:rename-entry', data),
  deleteLibraryEntry: (id) => ipcRenderer.invoke('library:delete-entry', id),
  getPathForFile: (file) => webUtils.getPathForFile(file),
});