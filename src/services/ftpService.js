const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const Client = require('ftp');
const mountUtils = require('../utils/mountUtils');
const debugUtils = require('../utils/debugUtils');

/**
 * Mount an FTP server on macOS using built-in Finder or macFUSE fallback
 * 
 * @param {string} host - FTP server hostname or IP
 * @param {number} port - FTP server port (default: 21)
 * @param {string} username - FTP username (default: anonymous)
 * @param {string} password - FTP password
 * @param {string} mountPoint - Where to mount the FTP filesystem
 * @returns {Promise<string>} - Result message
 */
exports.mount = async (host, port = 21, username = 'anonymous', password = '', mountPoint) => {
  return new Promise(async (resolve, reject) => {
    try {
      await debugUtils.log('Starting FTP mount', { host, port, username: username, mountPoint });
      
      // Log the mount point we're attempting to use
      await debugUtils.log(`Using mount point: ${mountPoint}`);
      
      // For /Volumes paths, we don't need to create them - the OS will handle this
      // Only create directories for custom mount points outside of /Volumes
      if (!mountPoint.startsWith('/Volumes/')) {
        try {
          await fs.ensureDir(mountPoint);
          await debugUtils.log(`Custom mount point created: ${mountPoint}`);
        } catch (dirError) {
          await debugUtils.logError('Creating custom mount point directory', dirError);
          return reject(new Error(`Failed to create custom mount point directory: ${dirError.message}`));
        }
      }
      
      // Try three different mounting approaches in sequence
      const tryNativeMount = async () => {
        try {
          await debugUtils.log('Trying native Finder mount method');
          // Encode password for URL
          const encodedPassword = encodeURIComponent(password);
          const ftpUrl = `ftp://${username}:${encodedPassword}@${host}:${port}`;
          
          // Use macOS built-in open command to mount via Finder
          const openCmd = `open '${ftpUrl}'`;
          // Log command without exposing password
          await debugUtils.log(`Running command to open FTP URL for ${username}@${host}:${port}`);
          
          exec(openCmd, async (error, stdout, stderr) => {
            if (error) {
              await debugUtils.logError('Native Finder mount', error);
              await debugUtils.log('Falling back to AppleScript mount method');
              tryAppleScriptMount();
              return;
            }
            
            if (stderr) {
              await debugUtils.log(`Command stderr: ${stderr}`);
            }
            
            await debugUtils.log(`Command stdout: ${stdout}`);
            await debugUtils.log('Native Finder mount successful');
            
            // Register mount for tracking
            await mountUtils.addMount({
              type: 'ftp',
              host,
              mountPoint: `/Volumes/${host}`, // macOS will auto-name the volume
              timestamp: new Date()
            });
            
            resolve(`FTP server ${host} mounted successfully via Finder`);
          });
        } catch (error) {
          await debugUtils.logError('Native Finder mount exception', error);
          // Fall back to AppleScript approach
          await debugUtils.log('Falling back to AppleScript mount method');
          tryAppleScriptMount();
        }
      };
      
      const tryAppleScriptMount = async () => {
        try {
          await debugUtils.log('Trying AppleScript mount method');
          const ftpUrl = `ftp://${username}:${password}@${host}:${port}`;
          const osascriptCmd = `osascript -e 'tell application "Finder" to mount volume "${ftpUrl}"'`;
          // Log command without exposing password
          await debugUtils.log(`Running AppleScript to mount FTP URL for ${username}@${host}:${port}`);
          
          exec(osascriptCmd, async (error, stdout, stderr) => {
            if (error) {
              await debugUtils.logError('AppleScript mount', error);
              await debugUtils.log('Falling back to macFUSE mount method');
              tryMacFuseMount();
              return;
            }
            
            if (stderr) {
              await debugUtils.log(`Command stderr: ${stderr}`);
            }
            
            await debugUtils.log(`Command stdout: ${stdout}`);
            await debugUtils.log('AppleScript mount successful');
            
            // Register mount for tracking
            await mountUtils.addMount({
              type: 'ftp',
              host,
              mountPoint: mountPoint,
              timestamp: new Date()
            });
            
            resolve(`FTP server ${host} mounted successfully via AppleScript`);
          });
        } catch (error) {
          await debugUtils.logError('AppleScript mount exception', error);
          // Fall back to macFUSE
          await debugUtils.log('Falling back to macFUSE mount method');
          tryMacFuseMount();
        }
      };
      
      const tryMacFuseMount = async () => {
        await debugUtils.log('Trying macFUSE mount method');
        
        // Check for macFUSE using multiple methods
        const checkMacFuseCmd = 'pkgutil --pkgs | grep -i fuse || brew list | grep -i macfuse || ls -la /Library/Filesystems 2>/dev/null | grep -i fuse';
        await debugUtils.log(`Checking for macFUSE with command: ${checkMacFuseCmd}`);
        
        exec(checkMacFuseCmd, async (error, stdout, stderr) => {
          if (error || !stdout.includes('fuse')) {
            await debugUtils.log('macFUSE not found on system', { error: error?.message, stdout, stderr });
            return reject(new Error('All mount methods failed. Please install macFUSE first: https://github.com/osxfuse/osxfuse/releases/'));
          }
          
          await debugUtils.log('macFUSE detected, proceeding with mount');
          
          // Create a .netrc file for authentication if credentials provided
          if (username !== 'anonymous' || password) {
            const homeDir = process.env.HOME;
            const netrcPath = path.join(homeDir, '.netrc');
            const netrcContent = `machine ${host} login ${username} password ${password}`;
            
            try {
              await debugUtils.log(`Creating .netrc file at ${netrcPath} for ${username}@${host}`);
              await fs.writeFile(netrcPath, netrcContent, { mode: 0o600 });
              await debugUtils.log('.netrc file created successfully');
            } catch (err) {
              await debugUtils.logError('Creating .netrc file', err);
              return reject(new Error(`Failed to create .netrc file: ${err.message}`));
            }
          }
          
          // Create mount command
          const ftpUrl = `ftp://${username}:${password}@${host}:${port}`;
          const mountCommand = `mount_ftp ${ftpUrl} ${mountPoint}`;
          // Log command without exposing password
          await debugUtils.log(`Running mount command for ${username}@${host}:${port} to ${mountPoint}`);
          
          exec(mountCommand, async (error, stdout, stderr) => {
            if (error) {
              await debugUtils.logError('mount_ftp command', error);
              await debugUtils.log('Falling back to curl mount method');
              
              // Try with curl
              const curlMount = `curl -u "${username}:${password}" -o /dev/null "ftp://${host}:${port}" && mkdir -p "${mountPoint}" && mount_curl "${ftpUrl}" "${mountPoint}"`;
              // Log command without exposing password
              await debugUtils.log(`Running curl mount command for ${username}@${host}:${port} to ${mountPoint}`);
              
              exec(curlMount, async (error, stdout, stderr) => {
                if (error) {
                  await debugUtils.logError('curl mount command', error);
                  await debugUtils.log('All mount methods failed');
                  return reject(new Error(`All FTP mounting methods failed: ${stderr || error.message}`));
                }
                
                await debugUtils.log('curl mount successful');
                
                // Register mount for tracking
                await mountUtils.addMount({
                  type: 'ftp',
                  host,
                  mountPoint,
                  timestamp: new Date()
                });
                
                resolve(`FTP server ${host} mounted successfully at ${mountPoint} using curl`);
              });
              return;
            }
            
            await debugUtils.log('mount_ftp command successful');
            
            // Register mount for tracking
            await mountUtils.addMount({
              type: 'ftp',
              host,
              mountPoint,
              timestamp: new Date()
            });
            
            resolve(`FTP server ${host} mounted successfully at ${mountPoint}`);
          });
        });
      };
      
      // Start with native mount
      tryNativeMount();
    } catch (error) {
      await debugUtils.logError('FTP mount top-level error', error);
      reject(new Error(`Failed to mount FTP server: ${error.message}`));
    }
  });
};

/**
 * Test connection to an FTP server without mounting
 * 
 * @param {string} host - FTP server hostname or IP
 * @param {number} port - FTP server port (default: 21)
 * @param {string} username - FTP username
 * @param {string} password - FTP password
 * @returns {Promise<boolean>} - True if connection successful
 */
exports.testConnection = (host, port = 21, username = 'anonymous', password = '') => {
  return new Promise((resolve, reject) => {
    const client = new Client();
    
    client.on('ready', () => {
      client.end();
      resolve(true);
    });
    
    client.on('error', (err) => {
      reject(new Error(`FTP connection error: ${err.message}`));
    });
    
    client.connect({
      host,
      port,
      user: username,
      password
    });
  });
};