const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const SftpClient = require('ssh2-sftp-client');
const mountUtils = require('../utils/mountUtils');

/**
 * Mount an SFTP server on macOS using native mount_smbfs or SSHFS (requires macFUSE)
 * 
 * @param {string} host - SFTP server hostname or IP
 * @param {number} port - SFTP server port (default: 22)
 * @param {string} username - SFTP username
 * @param {string} password - SFTP password
 * @param {string} privateKey - Path to SSH private key file
 * @param {string} mountPoint - Where to mount the SFTP filesystem
 * @returns {Promise<string>} - Result message
 */
exports.mount = async (host, port = 22, username, password, privateKey, mountPoint) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Log the mount point we're attempting to use
      console.log(`Using SFTP mount point: ${mountPoint}`);
      
      // For /Volumes paths, we don't need to create them - the OS will handle this
      // Only create directories for custom mount points outside of /Volumes
      if (!mountPoint.startsWith('/Volumes/')) {
        await fs.ensureDir(mountPoint);
      }
      
      // First try native macOS mount method
      const useNativeMount = async () => {
        try {
          // Create credentials file for SSH if using private key
          let sshOpts = '';
          
          if (privateKey) {
            const keyPath = path.resolve(privateKey);
            if (!await fs.pathExists(keyPath)) {
              throw new Error(`Private key file not found: ${keyPath}`);
            }
            sshOpts = `-i ${keyPath}`;
          }
          
          // Using macOS built-in Finder-based mounting
          const mountCmd = `open 'sftp://${username}:${encodeURIComponent(password)}@${host}:${port}'`;
          
          exec(mountCmd, (error, stdout, stderr) => {
            if (error) {
              // If this fails, try alternative mount method
              fallbackMount();
              return;
            }
            
            // Register mount for tracking
            mountUtils.addMount({
              type: 'sftp',
              host,
              mountPoint: `/Volumes/${host}`, // macOS will auto-name the volume
              timestamp: new Date()
            });
            
            resolve(`SFTP server ${host} mounted successfully via Finder`);
          });
        } catch (error) {
          // If native mount fails, try fallback
          fallbackMount();
        }
      };
      
      // Fallback to traditional SSHFS if available
      const fallbackMount = async () => {
        // Check if macFUSE is installed
        exec('ls -la /Library/Filesystems 2>/dev/null | grep -i fuse', async (error, stdout, stderr) => {
          if (error || !stdout.includes('fuse')) {
            return reject(new Error('macFUSE not installed. Please install macFUSE first: https://github.com/osxfuse/osxfuse/releases/'));
          }
          
          // Try using mount_smbfs for mounting
          try {
            // Try osascript approach to mount via Finder
            const osascriptCmd = `osascript -e 'tell application "Finder" to mount volume "sftp://${username}:${password}@${host}:${port}"'`;
            
            exec(osascriptCmd, (error, stdout, stderr) => {
              if (error) {
                // If all else fails, try sshfs if available
                trySSHFS();
                return;
              }
              
              // Register mount for tracking
              mountUtils.addMount({
                type: 'sftp',
                host,
                mountPoint, // Use the requested mount point
                timestamp: new Date()
              });
              
              resolve(`SFTP server ${host} mounted successfully via AppleScript`);
            });
          } catch (error) {
            trySSHFS();
          }
        });
      };
      
      // Try SSHFS as last resort
      const trySSHFS = () => {
        exec('which sshfs', async (error, stdout, stderr) => {
          if (error || !stdout.trim()) {
            return reject(new Error('SFTP mounting failed. Install macFUSE from https://github.com/osxfuse/osxfuse/releases/ and restart your computer.'));
          }
          
          // Build the SSHFS command
          let sshfsCommand = `sshfs ${username}@${host}:/ ${mountPoint} -p ${port} -o reconnect,defer_permissions,noappledouble,noapplexattr,volname=${host}`;
          
          // Add key or password options
          if (privateKey) {
            const keyPath = path.resolve(privateKey);
            if (!await fs.pathExists(keyPath)) {
              return reject(new Error(`Private key file not found: ${keyPath}`));
            }
            sshfsCommand += ` -o IdentityFile=${keyPath}`;
          } else if (password) {
            // Try with SSH agent approach instead of sshpass
            const tmpDir = path.join(os.tmpdir(), 'webtunelcmounter');
            await fs.ensureDir(tmpDir);
            const pwFile = path.join(tmpDir, `sftp_pass_${Date.now()}.txt`);
            await fs.writeFile(pwFile, password, { mode: 0o600 });
            
            sshfsCommand = `SSH_ASKPASS="cat ${pwFile}" sshfs ${username}@${host}:/ ${mountPoint} -p ${port} -o reconnect,defer_permissions,noappledouble,noapplexattr,volname=${host}`;
          }
          
          // Execute the mount command
          exec(sshfsCommand, async (error, stdout, stderr) => {
            // Clean up temp password file if it exists
            if (password) {
              try {
                const tmpDir = path.join(os.tmpdir(), 'webtunelcmounter');
                const files = await fs.readdir(tmpDir);
                for (const file of files) {
                  if (file.startsWith('sftp_pass_')) {
                    await fs.unlink(path.join(tmpDir, file));
                  }
                }
              } catch (cleanupError) {
                // Ignore cleanup errors
              }
            }
            
            if (error) {
              return reject(new Error(`Failed to mount SFTP: ${stderr || error.message}`));
            }
            
            // Register mount for tracking
            mountUtils.addMount({
              type: 'sftp',
              host,
              mountPoint,
              timestamp: new Date()
            });
            
            resolve(`SFTP server ${host} mounted successfully at ${mountPoint}`);
          });
        });
      };
      
      // Start with native mount attempt
      useNativeMount();
    } catch (error) {
      reject(new Error(`Failed to mount SFTP server: ${error.message}`));
    }
  });
};

/**
 * Execute the mount command and handle the result
 */
function performMount(command, host, mountPoint, resolve, reject) {
  exec(command, (error, stdout, stderr) => {
    if (error) {
      return reject(new Error(`Failed to mount SFTP: ${stderr || error.message}`));
    }
    
    // Register mount for tracking
    mountUtils.addMount({
      type: 'sftp',
      host,
      mountPoint,
      timestamp: new Date()
    });
    
    resolve(`SFTP server ${host} mounted successfully at ${mountPoint}`);
  });
}

/**
 * Test connection to an SFTP server without mounting
 * 
 * @param {string} host - SFTP server hostname or IP
 * @param {number} port - SFTP server port
 * @param {string} username - SFTP username
 * @param {string} password - SFTP password
 * @param {string} privateKey - Path to SSH private key file
 * @returns {Promise<boolean>} - True if connection successful
 */
exports.testConnection = async (host, port = 22, username, password, privateKey) => {
  const sftp = new SftpClient();
  
  try {
    const connectConfig = {
      host,
      port,
      username
    };
    
    if (privateKey) {
      const keyPath = path.resolve(privateKey);
      if (!await fs.pathExists(keyPath)) {
        throw new Error(`Private key file not found: ${keyPath}`);
      }
      connectConfig.privateKey = await fs.readFile(keyPath);
    } else if (password) {
      connectConfig.password = password;
    } else {
      throw new Error('Either password or private key is required');
    }
    
    await sftp.connect(connectConfig);
    await sftp.end();
    return true;
  } catch (error) {
    throw new Error(`SFTP connection error: ${error.message}`);
  }
};