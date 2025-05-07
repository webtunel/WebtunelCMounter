const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Temp directory for installation scripts
const TEMP_DIR = path.join(os.tmpdir(), 'webtunelcmounter');

/**
 * Check if macFUSE is installed
 * 
 * @returns {Promise<boolean>} - True if macFUSE is installed
 */
exports.isMacFuseInstalled = () => {
  return new Promise((resolve) => {
    // Check using multiple methods to detect macFUSE
    exec('pkgutil --pkgs | grep -i fuse', (pkgError, pkgStdout) => {
      if (!pkgError && pkgStdout.includes('fuse')) {
        resolve(true);
        return;
      }
      
      // Check via brew if available
      exec('brew list | grep -i macfuse', (brewError, brewStdout) => {
        if (!brewError && brewStdout.includes('macfuse')) {
          resolve(true);
          return;
        }
        
        // Check if FUSE filesystem is available
        exec('ls -la /Library/Filesystems 2>/dev/null | grep -i fuse', (fsError, fsStdout) => {
          if (!fsError && fsStdout.includes('fuse')) {
            resolve(true);
            return;
          }
          
          resolve(false);
        });
      });
    });
  });
};

/**
 * Check if Homebrew is installed
 * 
 * @returns {Promise<boolean>} - True if Homebrew is installed
 */
function isHomebrewInstalled() {
  return new Promise((resolve) => {
    exec('which brew', (error, stdout) => {
      resolve(!error && stdout.trim() !== '');
    });
  });
}

/**
 * Create and run a shell script with administrator privileges
 * using Apple's GUI password prompt
 * 
 * @param {string} scriptContent - Content of the shell script
 * @param {Function} progressCallback - Callback for progress updates
 * @returns {Promise<string>} - Output of the script
 */
function runScriptWithAdminGUI(scriptContent, progressCallback) {
  return new Promise((resolve, reject) => {
    // Ensure temp directory exists
    fs.ensureDirSync(TEMP_DIR);
    
    // Create a temporary script file
    const scriptPath = path.join(TEMP_DIR, `install_script_${Date.now()}.sh`);
    
    try {
      // Write script to file and make executable
      fs.writeFileSync(scriptPath, scriptContent);
      fs.chmodSync(scriptPath, '755');
      
      progressCallback('Requesting administrator privileges...');
      
      // Run script with osascript to get GUI password prompt
      const command = `osascript -e 'do shell script "${scriptPath.replace(/"/g, '\\\\"')}" with administrator privileges'`;
      
      exec(command, (error, stdout, stderr) => {
        // Clean up the script file
        try {
          fs.unlinkSync(scriptPath);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        
        if (error) {
          progressCallback(`Command failed: ${error.message}`);
          reject(error);
          return;
        }
        
        if (stdout) {
          progressCallback(stdout);
        }
        
        resolve(stdout);
      });
    } catch (error) {
      // Clean up in case of error
      try {
        fs.unlinkSync(scriptPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      reject(error);
    }
  });
}

/**
 * Install macFUSE using Homebrew with GUI password prompt
 * 
 * @param {Function} progressCallback - Callback for progress updates
 * @returns {Promise<boolean>} - True if install successful
 */
exports.installMacFuse = async (progressCallback) => {
  try {
    progressCallback('Starting macFUSE installation...');
    
    // Check if Homebrew is installed
    const hasHomebrew = await isHomebrewInstalled();
    
    // Create installation script
    let installScript;
    
    if (hasHomebrew) {
      installScript = `
#!/bin/bash
echo "Installing macFUSE via Homebrew..."
brew install --cask macfuse
echo "macFUSE installation completed!"
`;
    } else {
      // If Homebrew is not installed, install it first
      installScript = `
#!/bin/bash
echo "Installing Homebrew..."
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

echo "Adding Homebrew to PATH..."
if [[ $(uname -m) == "arm64" ]]; then
  # M1/M2 Mac
  eval "$(/opt/homebrew/bin/brew shellenv)"
else
  # Intel Mac
  eval "$(/usr/local/bin/brew shellenv)"
fi

echo "Installing macFUSE via Homebrew..."
brew install --cask macfuse
echo "macFUSE installation completed!"
`;
    }
    
    // Run the script with GUI password prompt
    progressCallback('Preparing to install macFUSE...');
    await runScriptWithAdminGUI(installScript, progressCallback);
    
    progressCallback('macFUSE installed successfully! Please restart your computer to complete the installation.');
    return true;
    
  } catch (error) {
    progressCallback(`Error installing macFUSE: ${error.message}`);
    progressCallback('Please install macFUSE manually by running: brew install --cask macfuse');
    return false;
  }
};

/**
 * Check if SSHFS is installed
 * 
 * @returns {Promise<boolean>} - True if SSHFS is installed
 */
exports.isSshfsInstalled = () => {
  return new Promise((resolve) => {
    // For modern macOS, we'll consider SSHFS available if macFUSE is installed
    // as we'll use the native mount functionality instead of the sshfs command
    exports.isMacFuseInstalled().then(hasMacFuse => {
      if (hasMacFuse) {
        // If macFUSE is installed, we can proceed with SFTP mounting
        resolve(true);
        return;
      }
      
      // As a fallback, check for the sshfs command
      exec('which sshfs', (error, stdout) => {
        resolve(!error && stdout.trim() !== '');
      });
    });
  });
};

/**
 * Install SSHFS using Homebrew with GUI password prompt
 * 
 * @param {Function} progressCallback - Callback for progress updates
 * @returns {Promise<boolean>} - True if install successful
 */
exports.installSshfs = async (progressCallback) => {
  try {
    progressCallback('Starting SSHFS installation...');
    
    // Check if Homebrew is installed
    const hasHomebrew = await isHomebrewInstalled();
    
    // Create installation script
    let installScript;
    
    if (hasHomebrew) {
      installScript = `
#!/bin/bash
echo "Installing SSHFS via Homebrew..."
brew install sshfs
echo "SSHFS installation completed!"
`;
    } else {
      // If Homebrew is not installed, install it first
      installScript = `
#!/bin/bash
echo "Installing Homebrew..."
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

echo "Adding Homebrew to PATH..."
if [[ $(uname -m) == "arm64" ]]; then
  # M1/M2 Mac
  eval "$(/opt/homebrew/bin/brew shellenv)"
else
  # Intel Mac
  eval "$(/usr/local/bin/brew shellenv)"
fi

echo "Installing SSHFS via Homebrew..."
brew install sshfs
echo "SSHFS installation completed!"
`;
    }
    
    // Run the script with GUI password prompt
    progressCallback('Preparing to install SSHFS...');
    await runScriptWithAdminGUI(installScript, progressCallback);
    
    progressCallback('SSHFS installed successfully!');
    return true;
    
  } catch (error) {
    progressCallback(`Error installing SSHFS: ${error.message}`);
    progressCallback('Please install SSHFS manually by running: brew install sshfs');
    return false;
  }
};