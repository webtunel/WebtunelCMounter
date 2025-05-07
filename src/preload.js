const { contextBridge, ipcRenderer } = require('electron');

// Expose IPC API to renderer process
contextBridge.exposeInMainWorld('api', {
  // Connection management
  getSavedConnections: () => ipcRenderer.invoke('get-saved-connections'),
  saveConnection: (connection) => ipcRenderer.invoke('save-connection', connection),
  removeConnection: (connectionName) => ipcRenderer.invoke('remove-connection', connectionName),
  
  // Mounting operations
  mountConnection: (connection) => ipcRenderer.invoke('mount-connection', connection),
  unmountConnection: (mountPoint) => ipcRenderer.invoke('unmount-connection', mountPoint),
  getMounts: () => ipcRenderer.invoke('get-mounts'),
  
  // File dialogs
  selectDirectory: (path) => ipcRenderer.invoke('select-directory', path),
  selectFile: () => ipcRenderer.invoke('select-file'),
  
  // Installer functionality
  isMacFuseInstalled: () => ipcRenderer.invoke('is-macfuse-installed'),
  isSshfsInstalled: () => ipcRenderer.invoke('is-sshfs-installed'),
  installMacFuse: (progressCallback) => {
    // Register temporary listener for progress
    ipcRenderer.on('install-progress', (_event, message) => {
      if (progressCallback) progressCallback(message);
    });
    
    return ipcRenderer.invoke('install-macfuse').finally(() => {
      // Clean up listener when done
      ipcRenderer.removeAllListeners('install-progress');
    });
  },
  installSshfs: (progressCallback) => {
    // Register temporary listener for progress
    ipcRenderer.on('install-progress', (_event, message) => {
      if (progressCallback) progressCallback(message);
    });
    
    return ipcRenderer.invoke('install-sshfs').finally(() => {
      // Clean up listener when done
      ipcRenderer.removeAllListeners('install-progress');
    });
  },
  continueToApp: () => ipcRenderer.invoke('continue-to-app'),

  // Event listeners
  onMountFromTray: (callback) => {
    ipcRenderer.on('mount-from-tray', (_event, connectionName) => {
      if (callback) callback(connectionName);
    });
  },
  onShowActiveMounts: (callback) => {
    ipcRenderer.on('show-active-mounts', () => {
      if (callback) callback();
    });
  },
  onShowDebugLogs: (callback) => {
    ipcRenderer.on('show-debug-logs', () => {
      if (callback) callback();
    });
  },
  
  // Debug utilities
  getDebugLogs: () => ipcRenderer.invoke('get-debug-logs'),
  clearDebugLogs: () => ipcRenderer.invoke('clear-debug-logs'),
  
  // Window controls
  closeWindow: () => ipcRenderer.send('window-close'),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  
  // Cleanup
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('mount-from-tray');
    ipcRenderer.removeAllListeners('show-active-mounts');
    ipcRenderer.removeAllListeners('show-debug-logs');
  }
});