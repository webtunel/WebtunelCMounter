// DOM Elements
const connectionListEl = document.getElementById('connection-list');
const connectionForm = document.getElementById('connection-form');
const formTitle = document.getElementById('form-title');
const formActions = document.getElementById('form-actions');
const newConnectionBtn = document.getElementById('new-connection-btn');
const mountBtn = document.getElementById('mount-btn');
const deleteBtn = document.getElementById('delete-btn');
const connectionNameInput = document.getElementById('connection-name');
const connectionTypeSelect = document.getElementById('connection-type');
const hostInput = document.getElementById('host');
const portInput = document.getElementById('port');
const urlInput = document.getElementById('url');
const shareInput = document.getElementById('share');
const domainInput = document.getElementById('domain');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const privateKeyInput = document.getElementById('private-key');
const mountPointInput = document.getElementById('mount-point');
const browseKeyBtn = document.getElementById('browse-key-btn');
const browseMountBtn = document.getElementById('browse-mount-btn');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const mountsListEl = document.getElementById('mounts-list');
const noMountsMessage = document.getElementById('no-mounts-message');
const notificationToast = document.getElementById('notification-toast');
const notificationMessage = document.getElementById('notification-message');
const notificationClose = document.getElementById('notification-close');
const statusMessage = document.getElementById('status-message');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Host and port rows
const hostRow = document.getElementById('host-row');
const portRow = document.getElementById('port-row');
const urlRow = document.getElementById('url-row');
const shareRow = document.getElementById('share-row');
const domainRow = document.getElementById('domain-row');
const privateKeyRow = document.getElementById('private-key-row');

// State variables
let currentConnectionName = null;
let connections = [];
let mounts = [];

// Utils
function showNotification(message, type = 'success') {
  // Use native notifications if available
  if (window.Notification && Notification.permission === "granted") {
    const notification = new Notification("MacCloudMounter", {
      body: message,
      icon: "../assets/icons/icon-32.png"
    });
    
    // Auto close after 5 seconds
    setTimeout(() => notification.close(), 5000);
  } else {
    // Fallback to in-app notification
    notificationMessage.textContent = message;
    notificationToast.className = `notification ${type} visible`;
    setTimeout(() => {
      notificationToast.className = 'notification hidden';
    }, 5000);
  }
  
  // Request permission for native notifications if not already granted
  if (window.Notification && Notification.permission !== "granted") {
    Notification.requestPermission();
  }
}

function updateStatus(message) {
  statusMessage.textContent = message;
}

function formatDate(timestamp) {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  
  // Format date in macOS style: Today at 12:34 PM or May 7 at 12:34 PM
  const now = new Date();
  const isToday = date.getDate() === now.getDate() && 
                 date.getMonth() === now.getMonth() && 
                 date.getFullYear() === now.getFullYear();
  
  const timeOptions = { hour: 'numeric', minute: 'numeric', hour12: true };
  const time = date.toLocaleTimeString(undefined, timeOptions);
  
  if (isToday) {
    return `Today at ${time}`;
  } else {
    const dateOptions = { month: 'short', day: 'numeric' };
    const dateStr = date.toLocaleDateString(undefined, dateOptions);
    return `${dateStr} at ${time}`;
  }
}

// Connections Tab functions
async function loadConnections() {
  try {
    updateStatus('Loading connections...');
    connections = await window.api.getSavedConnections();
    renderConnectionList();
    updateStatus('Ready');
  } catch (error) {
    console.error('Error loading connections:', error);
    showNotification('Failed to load connections', 'error');
    updateStatus('Error loading connections');
  }
}

function renderConnectionList() {
  connectionListEl.innerHTML = '';
  
  connections.forEach(connection => {
    const connectionEl = document.createElement('div');
    connectionEl.className = `connection-item ${connection.name === currentConnectionName ? 'active' : ''}`;
    connectionEl.dataset.name = connection.name;
    
    const typeAbbr = {
      'ftp': 'FTP',
      'sftp': 'SFTP',
      'samba': 'SMB',
      'webdav': 'DAV'
    };
    
    let serverDetails = '';
    if (connection.type === 'webdav') {
      serverDetails = connection.url || '';
    } else {
      serverDetails = connection.host || '';
      if (connection.type === 'samba' && connection.share) {
        serverDetails += `/${connection.share}`;
      }
    }
    
    // Check if this connection is currently mounted
    const isCurrentlyMounted = mounts.some(mount => 
      mount.type === connection.type && 
      (
        (connection.type === 'webdav' && mount.url === connection.url) ||
        (connection.type !== 'webdav' && mount.host === connection.host &&
         (connection.type !== 'samba' || mount.share === connection.share))
      )
    );
    
    // Add main connection info
    connectionEl.innerHTML = `
      <div class="connection-icon ${connection.type}">${typeAbbr[connection.type]}</div>
      <div class="connection-details">
        <h4>${connection.name}</h4>
        <p>${serverDetails}</p>
        ${isCurrentlyMounted ? '<span class="mount-status"></span>' : ''}
      </div>
      <div class="connection-actions">
        ${isCurrentlyMounted ? 
          `<button class="connection-action-button unmount" title="Unmount">
            <span class="material-icons">link_off</span>
          </button>` : 
          `<button class="connection-action-button mount" title="Mount">
            <span class="material-icons">link</span>
          </button>`
        }
        <button class="connection-action-button edit" title="Edit">
          <span class="material-icons">edit</span>
        </button>
      </div>
    `;
    
    // Add event listener for the main connection item click
    connectionEl.addEventListener('click', (e) => {
      // If the click was on an action button, don't select the connection
      if (e.target.closest('.connection-actions')) {
        return;
      }
      
      document.querySelectorAll('.connection-item').forEach(item => {
        item.classList.remove('active');
      });
      connectionEl.classList.add('active');
      loadConnectionForm(connection.name);
    });
    
    // Add event listeners for the action buttons
    connectionEl.querySelector('.connection-action-button.edit').addEventListener('click', () => {
      document.querySelectorAll('.connection-item').forEach(item => {
        item.classList.remove('active');
      });
      connectionEl.classList.add('active');
      loadConnectionForm(connection.name);
    });
    
    if (isCurrentlyMounted) {
      connectionEl.querySelector('.connection-action-button.unmount').addEventListener('click', async () => {
        const mountInfo = mounts.find(mount => 
          mount.type === connection.type && 
          (
            (connection.type === 'webdav' && mount.url === connection.url) ||
            (connection.type !== 'webdav' && mount.host === connection.host &&
             (connection.type !== 'samba' || mount.share === connection.share))
          )
        );
        
        if (mountInfo) {
          await unmountFileSystem(mountInfo.mountPoint);
        }
      });
    } else {
      connectionEl.querySelector('.connection-action-button.mount').addEventListener('click', async () => {
        await mountConnection(connection);
      });
    }
    
    connectionListEl.appendChild(connectionEl);
  });
}

function loadConnectionForm(connectionName) {
  currentConnectionName = connectionName;
  const connection = connections.find(conn => conn.name === connectionName);
  
  if (connection) {
    formTitle.textContent = `Edit: ${connection.name}`;
    formActions.classList.remove('hidden');
    cancelBtn.classList.remove('hidden');
    
    connectionNameInput.value = connection.name;
    connectionTypeSelect.value = connection.type;
    hostInput.value = connection.host || '';
    portInput.value = connection.port || '';
    urlInput.value = connection.url || '';
    shareInput.value = connection.share || '';
    domainInput.value = connection.domain || '';
    usernameInput.value = connection.username || '';
    passwordInput.value = connection.password || '';
    privateKeyInput.value = connection.privateKey || '';
    mountPointInput.value = connection.mountPoint || '';
    
    // Update form fields visibility
    updateFormFields(connection.type);
  }
}

function resetConnectionForm() {
  currentConnectionName = null;
  formTitle.textContent = 'New Connection';
  formActions.classList.add('hidden');
  cancelBtn.classList.add('hidden');
  
  connectionForm.reset();
  updateFormFields('ftp');
  
  // Clear active selection
  document.querySelectorAll('.connection-item').forEach(item => {
    item.classList.remove('active');
  });
}

function updateFormFields(connectionType) {
  // Hide all specific fields
  hostRow.classList.remove('hidden');
  portRow.classList.remove('hidden');
  urlRow.classList.add('hidden');
  shareRow.classList.add('hidden');
  domainRow.classList.add('hidden');
  privateKeyRow.classList.add('hidden');
  
  // Set default port
  switch (connectionType) {
    case 'ftp':
      portInput.placeholder = '21';
      break;
    case 'sftp':
      portInput.placeholder = '22';
      privateKeyRow.classList.remove('hidden');
      break;
    case 'samba':
      portInput.placeholder = '445';
      shareRow.classList.remove('hidden');
      domainRow.classList.remove('hidden');
      break;
    case 'webdav':
      hostRow.classList.add('hidden');
      portRow.classList.add('hidden');
      urlRow.classList.remove('hidden');
      break;
  }
}

async function saveConnection() {
  // Create basic connection data
  const connectionData = {
    name: connectionNameInput.value.trim(),
    type: connectionTypeSelect.value
  };
  
  // Add type-specific fields
  if (connectionData.type === 'webdav') {
    connectionData.url = urlInput.value.trim();
  } else {
    connectionData.host = hostInput.value.trim();
    connectionData.port = portInput.value ? parseInt(portInput.value) : null;
    
    if (connectionData.type === 'samba') {
      connectionData.share = shareInput.value.trim();
      connectionData.domain = domainInput.value.trim();
    }
  }
  
  // Add authentication
  connectionData.username = usernameInput.value.trim();
  connectionData.password = passwordInput.value;
  
  if (connectionData.type === 'sftp' && privateKeyInput.value) {
    connectionData.privateKey = privateKeyInput.value.trim();
  }
  
  // Validate required fields
  if (!connectionData.name) {
    showNotification('Connection name is required', 'error');
    return;
  }
  
  if (connectionData.type === 'webdav' && !connectionData.url) {
    showNotification('WebDAV URL is required', 'error');
    return;
  } else if (connectionData.type !== 'webdav' && !connectionData.host) {
    showNotification('Host is required', 'error');
    return;
  }
  
  if (connectionData.type === 'samba' && !connectionData.share) {
    showNotification('Share name is required', 'error');
    return;
  }
  
  updateStatus('Saving connection...');
  
  try {
    connections = await window.api.saveConnection(connectionData);
    renderConnectionList();
    showNotification(`Connection "${connectionData.name}" saved successfully`);
    resetConnectionForm();
    updateStatus('Ready');
  } catch (error) {
    showNotification(`Failed to save connection: ${error.message}`, 'error');
    updateStatus('Error saving connection');
  }
}

async function deleteConnection() {
  if (!currentConnectionName) return;
  
  const confirmed = confirm(`Are you sure you want to delete the connection "${currentConnectionName}"?`);
  if (!confirmed) return;
  
  updateStatus('Deleting connection...');
  
  try {
    connections = await window.api.removeConnection(currentConnectionName);
    renderConnectionList();
    showNotification(`Connection "${currentConnectionName}" deleted`);
    resetConnectionForm();
    updateStatus('Ready');
  } catch (error) {
    showNotification(`Failed to delete connection: ${error.message}`, 'error');
    updateStatus('Error deleting connection');
  }
}

async function mountConnection(connectionArg) {
  // Handle both direct connection argument and current selection
  const connection = connectionArg || connections.find(conn => conn.name === currentConnectionName);
  if (!connection) return;
  
  updateStatus(`Mounting ${connection.name}...`);
  
  try {
    // Generate system mount point before mounting
    // Note: The actual mount point used by macOS might be different
    const systemMountPoint = generateMountPoint(connection);
    
    // Create a copy of connection with generated mount point
    const connectionWithMountPoint = {
      ...connection,
      mountPoint: systemMountPoint
    };
    
    const result = await window.api.mountConnection(connectionWithMountPoint);
    
    if (result.success) {
      showNotification(`Successfully mounted "${connection.name}"`);
      updateStatus('Ready');
      
      // Switch to active mounts tab
      activateTab('active-mounts');
      
      // Refresh mounts list
      loadMounts();
    } else {
      showNotification(`Failed to mount: ${result.error}`, 'error');
      updateStatus('Error mounting connection');
    }
  } catch (error) {
    showNotification(`Failed to mount: ${error.message}`, 'error');
    updateStatus('Error mounting connection');
  }
}

// Mounts Tab functions
async function loadMounts() {
  updateStatus('Loading active mounts...');
  
  try {
    const result = await window.api.getMounts();
    
    if (result.success) {
      mounts = result.mounts || [];
      renderMountsList();
      updateStatus('Ready');
    } else {
      showNotification(`Failed to load mounts: ${result.error}`, 'error');
      updateStatus('Error loading mounts');
    }
  } catch (error) {
    showNotification(`Failed to load mounts: ${error.message}`, 'error');
    updateStatus('Error loading mounts');
  }
}

function renderMountsList() {
  mountsListEl.innerHTML = '';
  
  if (mounts.length === 0) {
    noMountsMessage.classList.remove('hidden');
    return;
  }
  
  noMountsMessage.classList.add('hidden');
  
  mounts.forEach(mount => {
    const mountRow = document.createElement('tr');
    
    // Get server/URL info
    let serverInfo = '';
    if (mount.type === 'webdav') {
      serverInfo = mount.url || '';
    } else if (mount.type === 'samba') {
      serverInfo = `${mount.host}/${mount.share}`;
    } else {
      serverInfo = mount.host || '';
    }
    
    // Find a matching saved connection if any
    const savedConnection = connections.find(conn => {
      if (conn.type === mount.type) {
        if (conn.type === 'webdav') {
          return conn.url === mount.url;
        } else if (conn.type === 'samba') {
          return conn.host === mount.host && conn.share === mount.share;
        } else {
          return conn.host === mount.host;
        }
      }
      return false;
    });
    
    // Format the connected status with a colored indicator
    mountRow.innerHTML = `
      <td><span class="mount-status" title="Connected"></span></td>
      <td>${mount.type.toUpperCase()}</td>
      <td>${serverInfo}</td>
      <td>${mount.mountPoint}</td>
      <td>${formatDate(mount.timestamp)}</td>
      <td>
        <div class="mount-action-buttons">
          <button class="mount-action-button unmount unmount-btn" data-mount-point="${mount.mountPoint}" title="Unmount">
            <span class="material-icons" style="font-size: 14px; margin-right: 4px;">link_off</span>Unmount
          </button>
          <button class="mount-action-button open open-btn" data-mount-point="${mount.mountPoint}" title="Open in Finder">
            <span class="material-icons" style="font-size: 14px; margin-right: 4px;">folder_open</span>Open
          </button>
        </div>
      </td>
    `;
    
    mountsListEl.appendChild(mountRow);
  });
  
  // Add event listeners for unmount buttons
  document.querySelectorAll('.unmount-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const mountPoint = e.target.closest('.unmount-btn').dataset.mountPoint;
      await unmountFileSystem(mountPoint);
    });
  });
  
  // Add event listeners for open buttons
  document.querySelectorAll('.open-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const mountPoint = e.target.closest('.open-btn').dataset.mountPoint;
      openInFinder(mountPoint);
    });
  });
}

// Function to open a path in Finder
function openInFinder(path) {
  if (!path) return;
  
  updateStatus(`Opening ${path} in Finder...`);
  window.api.selectDirectory(path)
    .then(() => {
      updateStatus('Ready');
    })
    .catch(error => {
      console.error('Error opening in Finder:', error);
      updateStatus('Ready');
    });
}

async function unmountFileSystem(mountPoint) {
  if (!mountPoint) return;
  
  updateStatus(`Unmounting ${mountPoint}...`);
  
  try {
    const result = await window.api.unmountConnection(mountPoint);
    
    if (result.success) {
      showNotification(`Successfully unmounted "${mountPoint}"`);
      updateStatus('Ready');
      
      // Refresh mounts list
      loadMounts();
    } else {
      showNotification(`Failed to unmount: ${result.error}`, 'error');
      updateStatus('Error unmounting filesystem');
    }
  } catch (error) {
    showNotification(`Failed to unmount: ${error.message}`, 'error');
    updateStatus('Error unmounting filesystem');
  }
}

// Tab switching
function activateTab(tabName) {
  tabButtons.forEach(button => {
    if (button.dataset.tab === tabName) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  });
  
  tabContents.forEach(content => {
    if (content.id === `${tabName}-tab`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
  
  // Load data for active tab
  if (tabName === 'active-mounts') {
    loadMounts();
  }
}

// Helper function to generate system mount point
function generateMountPoint(connection) {
  let mountName = '';
  
  // Generate mount point name based on connection type
  if (connection.type === 'webdav') {
    // Extract hostname from URL
    try {
      const url = new URL(connection.url);
      mountName = url.hostname;
    } catch (e) {
      // If URL parsing fails, use connection name
      mountName = connection.name;
    }
  } else if (connection.type === 'samba') {
    // For Samba, use the share name
    mountName = connection.share || connection.host;
  } else {
    // For FTP/SFTP, use host
    mountName = connection.host;
  }
  
  // Clean up the name to be filesystem-friendly
  mountName = mountName.replace(/[^a-zA-Z0-9-_.]/g, '-');
  
  // Return the system Volumes path
  return `/Volumes/${mountName}`;
}

// Handle mounting from tray
async function handleMountFromTray(connectionName) {
  const connection = connections.find(conn => conn.name === connectionName);
  if (connection) {
    // Show the user what's happening
    showNotification(`Mounting "${connectionName}" from tray menu...`);
    await mountConnection(connection);
  } else {
    showNotification(`Connection "${connectionName}" not found`, 'error');
  }
}

// Remove old window controls logic since we're using native controls

// Event Listeners
window.addEventListener('DOMContentLoaded', () => {
  
  // Load initial data
  setTimeout(() => {
    loadConnections();
  }, 500);
  
  // Tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      activateTab(button.dataset.tab);
    });
  });
  
  // New connection button
  newConnectionBtn.addEventListener('click', resetConnectionForm);
  
  // Type selection change
  connectionTypeSelect.addEventListener('change', () => {
    updateFormFields(connectionTypeSelect.value);
  });
  
  // Browse button for private key only
  browseKeyBtn.addEventListener('click', async () => {
    const file = await window.api.selectFile();
    if (file) {
      privateKeyInput.value = file;
    }
  });
  
  // Form submission
  connectionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveConnection();
  });
  
  // Action buttons
  mountBtn.addEventListener('click', mountConnection);
  deleteBtn.addEventListener('click', deleteConnection);
  cancelBtn.addEventListener('click', resetConnectionForm);
  
  // Close notification
  notificationClose.addEventListener('click', () => {
    notificationToast.className = 'notification hidden';
  });
  
  // Register IPC event listeners for tray interactions
  window.api.onMountFromTray((connectionName) => {
    handleMountFromTray(connectionName);
  });
  
  window.api.onShowActiveMounts(() => {
    activateTab('active-mounts');
  });
  
  // Clean up listeners when window is unloaded
  window.addEventListener('beforeunload', () => {
    window.api.removeAllListeners();
  });
});