const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Path to store mount data
const mountsFilePath = path.join(os.homedir(), '.webtunel-c-mounter', 'mounts.json');

/**
 * Initialize mounts tracking file
 */
const initMountsFile = async () => {
  try {
    // Ensure directory exists
    await fs.ensureDir(path.dirname(mountsFilePath));
    
    // Create file if it doesn't exist
    if (!await fs.pathExists(mountsFilePath)) {
      await fs.writeJson(mountsFilePath, { mounts: [] });
    }
  } catch (error) {
    console.error(`Failed to initialize mounts file: ${error.message}`);
  }
};

// Initialize the file on module load
initMountsFile();

/**
 * Add a mount to the tracking file
 * 
 * @param {Object} mountInfo - Information about the mount
 */
exports.addMount = async (mountInfo) => {
  try {
    await initMountsFile();
    const data = await fs.readJson(mountsFilePath);
    data.mounts.push(mountInfo);
    await fs.writeJson(mountsFilePath, data, { spaces: 2 });
  } catch (error) {
    console.error(`Failed to add mount to tracking: ${error.message}`);
  }
};

/**
 * Remove a mount from the tracking file
 * 
 * @param {string} mountPoint - Path where the filesystem is mounted
 */
exports.removeMount = async (mountPoint) => {
  try {
    await initMountsFile();
    const data = await fs.readJson(mountsFilePath);
    data.mounts = data.mounts.filter(mount => mount.mountPoint !== mountPoint);
    await fs.writeJson(mountsFilePath, data, { spaces: 2 });
  } catch (error) {
    console.error(`Failed to remove mount from tracking: ${error.message}`);
  }
};

/**
 * List all tracked mounts
 * 
 * @returns {Promise<Array>} - List of mount information
 */
exports.listMounts = async () => {
  try {
    await initMountsFile();
    const data = await fs.readJson(mountsFilePath);
    return data.mounts;
  } catch (error) {
    console.error(`Failed to list mounts: ${error.message}`);
    return [];
  }
};

/**
 * Unmount a filesystem
 * 
 * @param {string} mountPoint - Path where the filesystem is mounted
 * @returns {Promise<string>} - Result message
 */
exports.unmount = async (mountPoint) => {
  return new Promise((resolve, reject) => {
    // Check if mountPoint exists
    fs.access(mountPoint, fs.constants.F_OK, (err) => {
      if (err) {
        return reject(new Error(`Mount point ${mountPoint} does not exist`));
      }
      
      // Try to unmount
      exec(`umount "${mountPoint}"`, async (error, stdout, stderr) => {
        if (error) {
          // Try with diskutil on macOS
          exec(`diskutil unmount "${mountPoint}"`, async (error2, stdout2, stderr2) => {
            if (error2) {
              // Try with force unmount
              exec(`umount -f "${mountPoint}"`, async (error3, stdout3, stderr3) => {
                if (error3) {
                  return reject(new Error(`Failed to unmount ${mountPoint}: ${stderr3 || error3.message}`));
                }
                // Success with force unmount
                await exports.removeMount(mountPoint);
                resolve(`Successfully unmounted ${mountPoint} (forced)`);
              });
            } else {
              // Success with diskutil
              await exports.removeMount(mountPoint);
              resolve(`Successfully unmounted ${mountPoint}`);
            }
          });
        } else {
          // Success with standard umount
          await exports.removeMount(mountPoint);
          resolve(`Successfully unmounted ${mountPoint}`);
        }
      });
    });
  });
};

/**
 * Check if a path is currently mounted
 * 
 * @param {string} mountPoint - Path to check
 * @returns {Promise<boolean>} - True if mounted
 */
exports.isMounted = async (mountPoint) => {
  return new Promise((resolve) => {
    // Handle macOS specific volume paths
    if (!mountPoint.startsWith('/Volumes/') && !mountPoint.startsWith('/private/')) {
      // Check if the mountPoint is in /Volumes without explicit path
      const volumeName = path.basename(mountPoint);
      const volumePath = `/Volumes/${volumeName}`;
      
      exec('mount', (error, stdout, stderr) => {
        if (error) {
          resolve(false);
          return;
        }
        
        // Check if either mountPoint or volumePath appears in the mount list
        if (stdout.includes(mountPoint) || stdout.includes(volumePath)) {
          resolve(true);
        } else {
          // Try additional checks for Finder-mounted volumes that might have different names
          const lines = stdout.split('\n');
          const volumeLines = lines.filter(line => line.includes('/Volumes/'));
          
          // For each volume, check if it corresponds to our mount
          for (const line of volumeLines) {
            // Extract the source part (before "on")
            const parts = line.split(' on ');
            if (parts.length >= 2) {
              const sourcePart = parts[0];
              
              // Check if this volume source matches our expected server
              // This is a heuristic check for commonly mounted protocols
              if ((sourcePart.includes('ftp://') || 
                   sourcePart.includes('sftp://') || 
                   sourcePart.includes('smb://') || 
                   sourcePart.includes('webdav://')) &&
                  // Get the data from our tracked mounts
                  exports.getMountBySource(sourcePart)) {
                resolve(true);
                return;
              }
            }
          }
          
          resolve(false);
        }
      });
    } else {
      // Standard check for explicit paths
      exec('mount', (error, stdout, stderr) => {
        if (error) {
          resolve(false);
          return;
        }
        
        // Check if mountPoint appears in the mount list
        resolve(stdout.includes(mountPoint));
      });
    }
  });
};

/**
 * Find mount information by source URL/server
 * 
 * @param {string} source - Mount source (URL or server path)
 * @returns {Object|null} - Mount info or null if not found
 */
exports.getMountBySource = (source) => {
  try {
    const data = fs.readJsonSync(mountsFilePath);
    
    // Handle different protocol formats
    const mountInfo = data.mounts.find(mount => {
      if (mount.type === 'ftp' && source.includes(`ftp://${mount.host}`)) {
        return true;
      }
      if (mount.type === 'sftp' && source.includes(`sftp://${mount.host}`)) {
        return true;
      }
      if (mount.type === 'samba' && source.includes(`smb://${mount.host}/${mount.share}`)) {
        return true;
      }
      if (mount.type === 'webdav' && source.includes(mount.url)) {
        return true;
      }
      return false;
    });
    
    return mountInfo || null;
  } catch (error) {
    console.error(`Failed to find mount by source: ${error.message}`);
    return null;
  }
};