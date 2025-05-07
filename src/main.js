const { app, BrowserWindow, ipcMain, Menu, dialog, Tray } = require('electron');
const path = require('path');
const express = require('express');
const ftpService = require('./services/ftpService');
const sftpService = require('./services/sftpService');
const sambaService = require('./services/sambaService');
const webdavService = require('./services/webdavService');
const mountUtils = require('./utils/mountUtils');
const installerUtils = require('./utils/installerUtils');
const debugUtils = require('./utils/debugUtils');
const Store = require('electron-store');

// Initialize electron-store for persistent config
const store = new Store();

// Initialize express server for background API access
const server = express();
server.use(express.json());
const PORT = process.env.PORT || 3000;

// Global references
let mainWindow = null;
let installerWindow = null;
let apiServer = null;
let tray = null;

// Create the installer window
function createInstallerWindow() {
  installerWindow = new BrowserWindow({
    width: 650,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    resizable: false,
    fullscreenable: false
  });

  // Load the installer.html
  installerWindow.loadFile(path.join(__dirname, 'ui', 'installer.html'));

  // Handle window close event
  installerWindow.on('closed', () => {
    installerWindow = null;
  });
}

// Create the main Electron window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 700,
    minHeight: 500,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    // macOS specific settings
    titleBarStyle: 'default',
    frame: true, // Use the native frame
    vibrancy: 'window', // macOS 'vibrancy' effect
    visualEffectState: 'active',
    show: false // don't show until ready-to-show
  });

  // Load the index.html of the app
  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));

  // Only show window when it's ready to show (prevents flashing)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // On macOS, allow the app to continue running in the tray when window is closed
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin') {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  // Handle window close event
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Check if requirements are met
async function checkRequirements() {
  const hasMacFuse = await installerUtils.isMacFuseInstalled();
  const hasSshfs = await installerUtils.isSshfsInstalled();
  
  // Check if we've already shown the notification about restart needed
  const needsRestart = store.get('needsRestart', false);
  
  if (!hasMacFuse || !hasSshfs || needsRestart) {
    createInstallerWindow();
    return false;
  }
  
  return true;
}

// Set up the API endpoints for the express server
function setupApiServer() {
  // Mount FTP
  server.post('/mount/ftp', async (req, res) => {
    try {
      const { host, port, username, password, mountPoint } = req.body;
      
      if (!host || !mountPoint) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      const result = await ftpService.mount(host, port || 21, username || 'anonymous', password || '', mountPoint);
      res.json({ success: true, mountPoint, message: result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mount SFTP
  server.post('/mount/sftp', async (req, res) => {
    try {
      const { host, port, username, password, privateKey, mountPoint } = req.body;
      
      if (!host || !username || !mountPoint) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      const result = await sftpService.mount(host, port || 22, username, password, privateKey, mountPoint);
      res.json({ success: true, mountPoint, message: result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mount Samba
  server.post('/mount/samba', async (req, res) => {
    try {
      const { host, share, username, password, domain, mountPoint } = req.body;
      
      if (!host || !share || !mountPoint) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      const result = await sambaService.mount(host, share, username, password, domain, mountPoint);
      res.json({ success: true, mountPoint, message: result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mount WebDAV
  server.post('/mount/webdav', async (req, res) => {
    try {
      const { url, username, password, mountPoint } = req.body;
      
      if (!url || !mountPoint) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      const result = await webdavService.mount(url, username, password, mountPoint);
      res.json({ success: true, mountPoint, message: result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Unmount
  server.post('/unmount', async (req, res) => {
    try {
      const { mountPoint } = req.body;
      
      if (!mountPoint) {
        return res.status(400).json({ error: 'Missing mountPoint parameter' });
      }
      
      const result = await mountUtils.unmount(mountPoint);
      res.json({ success: true, message: result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // List mounts
  server.get('/mounts', async (req, res) => {
    try {
      const mounts = await mountUtils.listMounts();
      res.json({ mounts });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Start the server
  apiServer = server.listen(PORT, () => {
    console.log(`WebtunelCMounter API server listening on port ${PORT}`);
  });
}

// Handle IPC messages from renderer process
function setupIpcHandlers() {
  // Debug utilities
  ipcMain.handle('get-debug-logs', async () => {
    return await debugUtils.getLogContents();
  });
  
  ipcMain.handle('clear-debug-logs', async () => {
    await debugUtils.clearLog();
    return { success: true };
  });
  
  // Window control handlers
  ipcMain.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (process.platform === 'darwin') {
        win.hide(); // On macOS, just hide the window instead of closing
      } else {
        win.close();
      }
    }
  });
  
  ipcMain.on('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.minimize();
    }
  });
  
  ipcMain.on('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });
  
  // Installer IPC handlers
  ipcMain.handle('is-macfuse-installed', async () => {
    return await installerUtils.isMacFuseInstalled();
  });
  
  ipcMain.handle('is-sshfs-installed', async () => {
    return await installerUtils.isSshfsInstalled();
  });
  
  ipcMain.handle('install-macfuse', async (event) => {
    const result = await installerUtils.installMacFuse((message) => {
      // Send progress updates to renderer
      event.sender.send('install-progress', message);
    });
    
    if (result) {
      // Set flag to indicate restart needed
      store.set('needsRestart', true);
    }
    
    return result;
  });
  
  ipcMain.handle('install-sshfs', async (event) => {
    return await installerUtils.installSshfs((message) => {
      // Send progress updates to renderer
      event.sender.send('install-progress', message);
    });
  });
  
  ipcMain.handle('continue-to-app', () => {
    if (installerWindow) {
      installerWindow.close();
    }
    
    if (!mainWindow) {
      createMainWindow();
    }
  });

  // Get saved connections
  ipcMain.handle('get-saved-connections', () => {
    return store.get('connections', []);
  });

  // Save connection
  ipcMain.handle('save-connection', (event, connection) => {
    const connections = store.get('connections', []);
    
    // Check if connection already exists
    const connectionIndex = connections.findIndex(
      conn => conn.name === connection.name
    );
    
    if (connectionIndex >= 0) {
      // Update existing connection
      connections[connectionIndex] = connection;
    } else {
      // Add new connection
      connections.push(connection);
    }
    
    store.set('connections', connections);
    
    // Update the tray menu with the new connection list
    updateTrayMenu();
    
    return connections;
  });

  // Remove connection
  ipcMain.handle('remove-connection', (event, connectionName) => {
    const connections = store.get('connections', []);
    const filteredConnections = connections.filter(
      conn => conn.name !== connectionName
    );
    store.set('connections', filteredConnections);
    
    // Update the tray menu after removal
    updateTrayMenu();
    
    return filteredConnections;
  });

  // Mount connection
  ipcMain.handle('mount-connection', async (event, connection) => {
    // Log connection details without sensitive information
    const connectionInfo = {
      type: connection.type,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      mountPoint: connection.mountPoint,
      // Exclude password and privateKey
    };
    await debugUtils.log('Mount connection request received', connectionInfo);
    
    try {
      // Check if macFUSE is installed for protocols that need it
      if ((connection.type === 'ftp' || connection.type === 'sftp') && 
          !(await installerUtils.isMacFuseInstalled())) {
        await debugUtils.log('macFUSE not installed but required');
        if (!installerWindow) {
          createInstallerWindow();
        }
        return { 
          success: false, 
          error: 'macFUSE not installed. Please install macFUSE first.' 
        };
      }
      
      // Check if SSHFS is installed for SFTP
      if (connection.type === 'sftp' && !(await installerUtils.isSshfsInstalled())) {
        await debugUtils.log('SSHFS not installed but required');
        if (!installerWindow) {
          createInstallerWindow();
        }
        return { 
          success: false, 
          error: 'SSHFS not installed. Please install SSHFS first.' 
        };
      }
      
      await debugUtils.log(`Beginning mount operation for ${connection.type} connection`);
      let result = null;
      
      switch (connection.type) {
        case 'ftp':
          await debugUtils.log('Mounting FTP connection');
          result = await ftpService.mount(
            connection.host, 
            connection.port || 21, 
            connection.username || 'anonymous', 
            connection.password || '', 
            connection.mountPoint
          );
          break;
        case 'sftp':
          await debugUtils.log('Mounting SFTP connection');
          result = await sftpService.mount(
            connection.host, 
            connection.port || 22, 
            connection.username, 
            connection.password, 
            connection.privateKey, 
            connection.mountPoint
          );
          break;
        case 'samba':
          await debugUtils.log('Mounting Samba connection');
          result = await sambaService.mount(
            connection.host, 
            connection.share, 
            connection.username, 
            connection.password, 
            connection.domain, 
            connection.mountPoint
          );
          break;
        case 'webdav':
          await debugUtils.log('Mounting WebDAV connection');
          result = await webdavService.mount(
            connection.url, 
            connection.username, 
            connection.password, 
            connection.mountPoint
          );
          break;
        default:
          await debugUtils.log(`Unsupported connection type: ${connection.type}`);
          throw new Error(`Unsupported connection type: ${connection.type}`);
      }
      
      await debugUtils.log('Mount operation successful', { result });
      return { success: true, message: result };
    } catch (error) {
      await debugUtils.logError('Mount connection error', error);
      
      // Check if the error is related to missing macFUSE
      if (error.message.includes('macFUSE not installed') || 
          error.message.includes('SSHFS not installed')) {
        await debugUtils.log('Error related to missing dependencies');
        if (!installerWindow) {
          createInstallerWindow();
        }
      }
      return { success: false, error: error.message };
    }
  });

  // Unmount connection
  ipcMain.handle('unmount-connection', async (event, mountPoint) => {
    try {
      const result = await mountUtils.unmount(mountPoint);
      return { success: true, message: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get all mounts
  ipcMain.handle('get-mounts', async () => {
    try {
      const mounts = await mountUtils.listMounts();
      return { success: true, mounts };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Select directory dialog
  ipcMain.handle('select-directory', async (event, path) => {
    // If path is provided, try to open it directly in Finder
    if (path) {
      const { exec } = require('child_process');
      exec(`open "${path}"`, (error) => {
        if (error) {
          console.error(`Error opening path: ${error.message}`);
        }
      });
      return path;
    }
    
    // Otherwise use dialog
    const result = await dialog.showOpenDialog(mainWindow || null, {
      properties: ['openDirectory', 'createDirectory']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // Select file dialog (for private key)
  ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow || null, {
      properties: ['openFile']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });
}

// Helper function to create tray menu
function buildTrayMenu(mountSubmenu) {
  // Get current auto-start preference
  const openAtLogin = store.get('openAtLogin', true);
  
  return Menu.buildFromTemplate([
    {
      label: 'Mount Connection',
      submenu: mountSubmenu
    },
    { type: 'separator' },
    {
      label: 'Active Mounts',
      click: async () => {
        if (!mainWindow) {
          createMainWindow();
        } else {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.webContents.send('show-active-mounts');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Open WebtunelCMounter',
      click: () => {
        if (!mainWindow) {
          createMainWindow();
        } else {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Start at Login',
      type: 'checkbox',
      checked: openAtLogin,
      click: () => {
        const newSetting = !openAtLogin;
        store.set('openAtLogin', newSetting);
        app.setLoginItemSettings({
          openAtLogin: newSetting,
          openAsHidden: true
        });
        // Update the menu to reflect new setting
        updateTrayMenu();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: async () => {
        // Unmount all connected drives before quitting
        await unmountAllDrives();
        app.quit();
      }
    }
  ]);
}
// Create the tray icon
function createTray() {
  try {
    // Use a smaller icon size for the tray (16x16 for standard resolution, 32x32 for Retina displays)
    const iconPath = path.join(__dirname, 'assets', 'icons', 'icon-16.png');
    
    // Check if the icon file exists
    const fs = require('fs');
    if (!fs.existsSync(iconPath)) {
      console.error(`Tray icon not found at: ${iconPath}`);
      return null;
    }
    
    tray = new Tray(iconPath);
    tray.setToolTip('WebtunelCMounter');
    
    // Get saved connections for the tray menu
    const connections = store.get('connections', []);
    
    // Create mount submenu based on saved connections
    const mountSubmenu = connections.map(connection => {
      return {
        label: connection.name,
        click: async () => {
          try {
            // Show the main window if it's hidden
            if (!mainWindow) {
              createMainWindow();
            } else {
              if (mainWindow.isMinimized()) mainWindow.restore();
              mainWindow.show();
            }
            
            // Send event to renderer to mount this connection
            mainWindow.webContents.send('mount-from-tray', connection.name);
          } catch (error) {
            console.error('Error mounting from tray:', error);
          }
        }
      };
    });
    
    // If there are no connections, add a placeholder item
    if (mountSubmenu.length === 0) {
      mountSubmenu.push({
        label: 'No saved connections',
        enabled: false
      });
    }
    
    // Update the tray menu using the helper function
    const contextMenu = buildTrayMenu(mountSubmenu);
    
    tray.setContextMenu(contextMenu);
    
    // Create a simple menu for clicks (not contextmenu)
    const clickMenu = Menu.buildFromTemplate([
      {
        label: 'Show',
        click: () => {
          if (!mainWindow) {
            createMainWindow();
          } else {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: async () => {
          // Unmount all connected drives before quitting
          await unmountAllDrives();
          app.quit();
        }
      }
    ]);
    
    // On macOS, show simplified menu on click
    if (process.platform === 'darwin') {
      tray.on('click', (event, bounds) => {
        tray.popUpContextMenu(clickMenu);
      });
    }
    
    // Double-click opens the app
    tray.on('double-click', () => {
      if (!mainWindow) {
        createMainWindow();
      } else {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
      }
    });
    
    return tray;
  } catch (error) {
    console.error('Error creating tray:', error);
    return null;
  }
}

// Update the tray menu with current connections
function updateTrayMenu() {
  // If tray doesn't exist, try to create it first
  if (!tray) {
    try {
      const createdTray = createTray();
      if (!createdTray) {
        console.warn('Could not create tray icon when updating tray menu.');
        return;
      }
    } catch (error) {
      console.error('Failed to create tray when updating menu:', error);
      return;
    }
  }
  
  try {
    const connections = store.get('connections', []);
    
    // Create mount submenu based on saved connections
    const mountSubmenu = connections.map(connection => {
      return {
        label: connection.name,
        click: async () => {
          try {
            // Show the main window if it's hidden
            if (!mainWindow) {
              createMainWindow();
            } else {
              if (mainWindow.isMinimized()) mainWindow.restore();
              mainWindow.show();
            }
            
            // Send event to renderer to mount this connection
            mainWindow.webContents.send('mount-from-tray', connection.name);
          } catch (error) {
            console.error('Error mounting from tray:', error);
          }
        }
      };
    });
    
    // If there are no connections, add a placeholder item
    if (mountSubmenu.length === 0) {
      mountSubmenu.push({
        label: 'No saved connections',
        enabled: false
      });
    }
    
    // Update the tray menu using the helper function
    const contextMenu = buildTrayMenu(mountSubmenu);
    
    tray.setContextMenu(contextMenu);
  } catch (error) {
    console.error('Error updating tray menu:', error);
  }
}

// App initialization
app.whenReady().then(async () => {
  // Set application name for menu bar
  app.name = 'WebtunelCMounter';
  
  // Create application menu
  const menuTemplate = [
    {
      label: 'WebtunelCMounter',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Show Debug Logs',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('show-debug-logs');
            } else if (BrowserWindow.getAllWindows().length === 0) {
              createMainWindow();
              // Wait for window to be ready before sending the event
              mainWindow.webContents.once('did-finish-load', () => {
                mainWindow.webContents.send('show-debug-logs');
              });
            }
          }
        },
        {
          label: 'About WebtunelCMounter',
          click: () => {
            dialog.showMessageBox({
              title: 'About WebtunelCMounter',
              message: 'WebtunelCMounter',
              detail: `Version: ${app.getVersion()}\n\nA tool for mounting cloud services on macOS`,
              buttons: ['OK'],
              icon: path.join(__dirname, 'assets', 'icon.png')
            });
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
  
  // Set up login item based on user preference (default to true)
  const openAtLogin = store.get('openAtLogin', true);
  app.setLoginItemSettings({
    openAtLogin,
    openAsHidden: true
  });
  
  setupApiServer();
  setupIpcHandlers();
  
  // Create the tray icon - handle case where it might fail
  try {
    const createdTray = createTray();
    if (!createdTray) {
      console.warn('Could not create tray icon. Application will run without tray functionality.');
    }
  } catch (error) {
    console.error('Failed to create tray:', error);
  }
  
  // Check if all requirements are met
  const requirementsMet = await checkRequirements();
  
  if (requirementsMet) {
    createMainWindow();
  }
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (store.get('needsRestart', false)) {
        createInstallerWindow();
      } else {
        createMainWindow();
      }
    }
  });
});

// Function to unmount all connected drives
async function unmountAllDrives() {
  try {
    // Get all currently mounted drives
    const mounts = await mountUtils.listMounts();
    if (!mounts || mounts.length === 0) {
      console.log('No mounted drives to unmount');
      return;
    }
    
    await debugUtils.log(`Unmounting all drives (${mounts.length} found)`);
    
    // Unmount each drive
    for (const mount of mounts) {
      try {
        await debugUtils.log(`Unmounting: ${mount.mountPoint}`);
        await mountUtils.unmount(mount.mountPoint);
      } catch (error) {
        await debugUtils.logError(`Failed to unmount ${mount.mountPoint}`, error);
        console.error(`Failed to unmount ${mount.mountPoint}: ${error.message}`);
      }
    }
    
    await debugUtils.log('All drives unmounted');
  } catch (error) {
    await debugUtils.logError('Error in unmountAllDrives', error);
    console.error('Error in unmountAllDrives:', error);
  }
}

// Handle app quit
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  // Prevent immediate quit to allow async operations to complete
  if (!app.isQuitting) {
    event.preventDefault();
    app.isQuitting = true;
    
    // Unmount all connected drives
    await unmountAllDrives();
    
    // Clean up resources
    if (apiServer) {
      apiServer.close();
    }
    
    // Destroy tray icon before quitting
    if (tray) {
      tray.destroy();
      tray = null;
    }
    
    // Now actually quit
    app.quit();
  }
});