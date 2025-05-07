const { exec } = require('child_process');
const fs = require('fs-extra');
const SambaClient = require('samba-client');
const mountUtils = require('../utils/mountUtils');

/**
 * Mount a Samba/CIFS share on macOS using multiple methods for better reliability
 * 
 * @param {string} host - Samba server hostname or IP
 * @param {string} share - Share name
 * @param {string} username - Samba username
 * @param {string} password - Samba password
 * @param {string} domain - Domain (optional)
 * @param {string} mountPoint - Where to mount the Samba share
 * @returns {Promise<string>} - Result message
 */
exports.mount = async (host, share, username, password, domain, mountPoint) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Log the mount point we're attempting to use
      console.log(`Using Samba mount point: ${mountPoint}`);
      
      // For /Volumes paths, we don't need to create them - the OS will handle this
      // Only create directories for custom mount points outside of /Volumes
      if (!mountPoint.startsWith('/Volumes/')) {
        await fs.ensureDir(mountPoint);
      }
      
      // Try native Finder mount first
      const tryNativeMount = () => {
        try {
          // Format SMB URL for Finder
          let smbUrl = `smb://`;
          if (username) {
            const encodedUsername = encodeURIComponent(username);
            const encodedPassword = encodeURIComponent(password || '');
            
            if (domain) {
              smbUrl += `${domain};${encodedUsername}:${encodedPassword}@`;
            } else {
              smbUrl += `${encodedUsername}:${encodedPassword}@`;
            }
          }
          
          smbUrl += `${host}/${share}`;
          
          // Use open command to mount via Finder
          const openCmd = `open '${smbUrl}'`;
          
          exec(openCmd, (error, stdout, stderr) => {
            if (error) {
              // If this fails, try AppleScript approach
              tryAppleScriptMount();
              return;
            }
            
            // Register mount for tracking
            mountUtils.addMount({
              type: 'samba',
              host,
              share,
              mountPoint: `/Volumes/${share}`, // macOS will auto-name the volume
              timestamp: new Date()
            });
            
            resolve(`Samba share ${host}/${share} mounted successfully via Finder`);
          });
        } catch (error) {
          // Fall back to next method
          tryAppleScriptMount();
        }
      };
      
      const tryAppleScriptMount = () => {
        try {
          // Format SMB URL for AppleScript
          let smbUrl = `smb://`;
          if (username) {
            if (domain) {
              smbUrl += `${domain};${username}:${password}@`;
            } else {
              smbUrl += `${username}:${password}@`;
            }
          }
          
          smbUrl += `${host}/${share}`;
          
          const osascriptCmd = `osascript -e 'tell application "Finder" to mount volume "${smbUrl}"'`;
          
          exec(osascriptCmd, (error, stdout, stderr) => {
            if (error) {
              // If AppleScript fails, try mount_smbfs
              tryMountSmbfs();
              return;
            }
            
            // Register mount for tracking
            mountUtils.addMount({
              type: 'samba',
              host,
              share,
              mountPoint: `/Volumes/${share}`, // macOS will auto-name the volume
              timestamp: new Date()
            });
            
            resolve(`Samba share ${host}/${share} mounted successfully via AppleScript`);
          });
        } catch (error) {
          // Fall back to mount_smbfs
          tryMountSmbfs();
        }
      };
      
      const tryMountSmbfs = () => {
        // Build the mount command for macOS using mount_smbfs
        let mountCommand = `mount_smbfs`;
        
        // Add credentials if provided
        let credString = "";
        if (username) {
          credString = domain 
            ? `//${domain};${username}:${password}@${host}/${share}`
            : `//${username}:${password}@${host}/${share}`;
        } else {
          credString = `//guest@${host}/${share}`;
        }
        
        mountCommand += ` "${credString}" "${mountPoint}"`;
        
        exec(mountCommand, (error, stdout, stderr) => {
          if (error) {
            // Try generic mount command
            tryGenericMount();
            return;
          }
          
          // Register mount for tracking
          mountUtils.addMount({
            type: 'samba',
            host,
            share,
            mountPoint,
            timestamp: new Date()
          });
          
          resolve(`Samba share ${host}/${share} mounted successfully at ${mountPoint}`);
        });
      };
      
      const tryGenericMount = () => {
        // Last resort - try generic mount command
        let mountCommand = `mount -t smbfs`;
        
        // Add credentials if provided
        let credString = "";
        if (username) {
          credString = domain 
            ? `//${domain};${username}:${password}@${host}/${share}`
            : `//${username}:${password}@${host}/${share}`;
        } else {
          credString = `//guest@${host}/${share}`;
        }
        
        mountCommand += ` "${credString}" "${mountPoint}" -o nobrowse,nosuid,nodev`;
        
        exec(mountCommand, (error, stdout, stderr) => {
          if (error) {
            return reject(new Error(`All Samba mounting methods failed: ${stderr || error.message}`));
          }
          
          // Register mount for tracking
          mountUtils.addMount({
            type: 'samba',
            host,
            share,
            mountPoint,
            timestamp: new Date()
          });
          
          resolve(`Samba share ${host}/${share} mounted successfully at ${mountPoint}`);
        });
      };
      
      // Start with native mount attempt
      tryNativeMount();
    } catch (error) {
      reject(new Error(`Failed to mount Samba share: ${error.message}`));
    }
  });
};

/**
 * Test connection to a Samba server without mounting
 * 
 * @param {string} host - Samba server hostname or IP
 * @param {string} share - Share name
 * @param {string} username - Samba username
 * @param {string} password - Samba password
 * @param {string} domain - Domain (optional)
 * @returns {Promise<boolean>} - True if connection successful
 */
exports.testConnection = async (host, share, username, password, domain) => {
  try {
    const client = new SambaClient({
      address: `//${host}/${share}`,
      username: username || 'guest',
      password: password || '',
      domain: domain || ''
    });
    
    // Try to get a file listing to test the connection
    await client.list();
    return true;
  } catch (error) {
    throw new Error(`Samba connection error: ${error.message}`);
  }
};