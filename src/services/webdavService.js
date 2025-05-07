const { exec } = require('child_process');
const fs = require('fs-extra');
// Fix the webdav import to use dynamic import
const mountUtils = require('../utils/mountUtils');

/**
 * Mount a WebDAV server on macOS using multiple methods for better compatibility
 * 
 * @param {string} url - WebDAV server URL
 * @param {string} username - WebDAV username
 * @param {string} password - WebDAV password
 * @param {string} mountPoint - Where to mount the WebDAV share
 * @returns {Promise<string>} - Result message
 */
exports.mount = async (url, username, password, mountPoint) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Log the mount point we're attempting to use
      console.log(`Using WebDAV mount point: ${mountPoint}`);
      
      // For /Volumes paths, we don't need to create them - the OS will handle this
      // Only create directories for custom mount points outside of /Volumes
      if (!mountPoint.startsWith('/Volumes/')) {
        await fs.ensureDir(mountPoint);
      }
      
      // Try multiple mounting approaches
      const tryNativeMount = async () => {
        try {
          // Parse the URL
          const urlObj = new URL(url);
          
          // Format URL for Finder with credentials
          let finderUrl = url;
          if (username && password) {
            // Remove any existing auth from the URL
            const protocol = urlObj.protocol;
            const host = urlObj.host;
            const path = urlObj.pathname || '/';
            const encodedUsername = encodeURIComponent(username);
            const encodedPassword = encodeURIComponent(password);
            
            finderUrl = `${protocol}//${encodedUsername}:${encodedPassword}@${host}${path}`;
          }
          
          // Use open command to mount via Finder
          const openCmd = `open '${finderUrl}'`;
          
          exec(openCmd, (error, stdout, stderr) => {
            if (error) {
              // If this fails, try AppleScript approach
              tryAppleScriptMount();
              return;
            }
            
            // Extract hostname for volume name
            const hostname = new URL(url).hostname;
            
            // Register mount for tracking
            mountUtils.addMount({
              type: 'webdav',
              url,
              mountPoint: `/Volumes/${hostname}`, // macOS will auto-name the volume
              timestamp: new Date()
            });
            
            resolve(`WebDAV server ${url} mounted successfully via Finder`);
          });
        } catch (error) {
          // Fall back to next method
          tryAppleScriptMount();
        }
      };
      
      const tryAppleScriptMount = () => {
        try {
          // Format URL for AppleScript
          const appleScriptUrl = username && password 
            ? url.replace(/^(https?:\/\/)/, `$1${username}:${password}@`) 
            : url;
            
          const osascriptCmd = `osascript -e 'tell application "Finder" to mount volume "${appleScriptUrl}"'`;
          
          exec(osascriptCmd, (error, stdout, stderr) => {
            if (error) {
              // If AppleScript fails, try mount_webdav
              tryMountWebdav();
              return;
            }
            
            // Register mount for tracking
            mountUtils.addMount({
              type: 'webdav',
              url,
              mountPoint,
              timestamp: new Date()
            });
            
            resolve(`WebDAV server ${url} mounted successfully via AppleScript`);
          });
        } catch (error) {
          // Fall back to mount_webdav
          tryMountWebdav();
        }
      };
      
      const tryMountWebdav = () => {
        try {
          // Parse the URL to extract components
          const urlObj = new URL(url);
          
          // macOS mount_webdav command
          let mountCommand = `mount_webdav -i`;
          
          // Add credentials
          if (username && password) {
            mountCommand += ` -u "${username}" -p "${password}"`;
          }
          
          // Add URL and mount point
          mountCommand += ` "${url}" "${mountPoint}"`;
          
          exec(mountCommand, (error, stdout, stderr) => {
            if (error) {
              // Try generic mount command
              tryGenericMount();
              return;
            }
            
            // Register mount for tracking
            mountUtils.addMount({
              type: 'webdav',
              url,
              mountPoint,
              timestamp: new Date()
            });
            
            resolve(`WebDAV server ${url} mounted successfully at ${mountPoint}`);
          });
        } catch (error) {
          // Try one last method
          tryGenericMount();
        }
      };
      
      const tryGenericMount = () => {
        try {
          // Last resort - try generic mount command
          let genericCommand = `mount -t webdav`;
          
          // Add URL and mount point
          if (username && password) {
            const encodedUrl = url.replace(/^(https?:\/\/)/, `$1${username}:${password}@`);
            genericCommand += ` "${encodedUrl}" "${mountPoint}"`;
          } else {
            genericCommand += ` "${url}" "${mountPoint}"`;
          }
          
          exec(genericCommand, (error, stdout, stderr) => {
            if (error) {
              return reject(new Error(`All WebDAV mounting methods failed: ${stderr || error.message}`));
            }
            
            // Register mount for tracking
            mountUtils.addMount({
              type: 'webdav',
              url,
              mountPoint,
              timestamp: new Date()
            });
            
            resolve(`WebDAV server ${url} mounted successfully at ${mountPoint}`);
          });
        } catch (error) {
          reject(new Error(`Failed to mount WebDAV server: ${error.message}`));
        }
      };
      
      // Start with native mount attempt
      tryNativeMount();
    } catch (error) {
      reject(new Error(`Failed to mount WebDAV server: ${error.message}`));
    }
  });
};

/**
 * Test connection to a WebDAV server without mounting
 * 
 * @param {string} url - WebDAV server URL
 * @param {string} username - WebDAV username
 * @param {string} password - WebDAV password
 * @returns {Promise<boolean>} - True if connection successful
 */
exports.testConnection = async (url, username, password) => {
  try {
    // Dynamic import of webdav module
    const { createClient } = await import('webdav');
    
    const client = createClient(url, {
      username,
      password
    });
    
    // Try to get a file listing to test the connection
    await client.getDirectoryContents('/');
    return true;
  } catch (error) {
    throw new Error(`WebDAV connection error: ${error.message}`);
  }
};