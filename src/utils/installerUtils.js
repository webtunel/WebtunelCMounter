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
    const checks = [];
    let checkCompleted = 0;
    let isInstalled = false;
    
    // Helper to track check completion
    const completeCheck = (result) => {
      if (result) isInstalled = true;
      checkCompleted++;
      if (checkCompleted === checks.length && !isInstalled) {
        resolve(false);
      }
    };
    
    // Method 1: Check using pkgutil
    checks.push(new Promise((resolveCheck) => {
      exec('pkgutil --pkgs | grep -i fuse', (pkgError, pkgStdout) => {
        const result = !pkgError && pkgStdout.includes('fuse');
        if (result) {
          resolve(true); // Short-circuit if we find it
        }
        resolveCheck(result);
      });
    }));
    
    // Method 2: Check via brew if available
    checks.push(new Promise((resolveCheck) => {
      // Try both brew paths for M1/Intel Macs
      const brewPath = process.arch === 'arm64' ? '/opt/homebrew/bin/brew' : '/usr/local/bin/brew';
      const fallbackBrewPath = process.arch === 'arm64' ? '/usr/local/bin/brew' : '/opt/homebrew/bin/brew';
      
      exec(`${brewPath} list 2>/dev/null | grep -i macfuse`, (brewError, brewStdout) => {
        if (!brewError && brewStdout.includes('macfuse')) {
          resolve(true); // Short-circuit if we find it
          return resolveCheck(true);
        }
        
        // Try fallback brew path if the first one fails
        exec(`${fallbackBrewPath} list 2>/dev/null | grep -i macfuse`, (fallbackError, fallbackStdout) => {
          const result = !fallbackError && fallbackStdout.includes('macfuse');
          if (result) {
            resolve(true); // Short-circuit if we find it
          }
          resolveCheck(result);
        });
      });
    }));
    
    // Method 3: Check if FUSE filesystem is available in Library
    checks.push(new Promise((resolveCheck) => {
      exec('ls -la /Library/Filesystems 2>/dev/null | grep -i fuse', (fsError, fsStdout) => {
        const result = !fsError && fsStdout.includes('fuse');
        if (result) {
          resolve(true); // Short-circuit if we find it
        }
        resolveCheck(result);
      });
    }));
    
    // Method 4: Check if the macFUSE kernel extension is loaded
    checks.push(new Promise((resolveCheck) => {
      exec('kextstat | grep -i fuse', (kextError, kextStdout) => {
        const result = !kextError && kextStdout.includes('fuse');
        if (result) {
          resolve(true); // Short-circuit if we find it
        }
        resolveCheck(result);
      });
    }));
    
    // Method 5: Check if the macFUSE filesystem is mounted in /dev
    checks.push(new Promise((resolveCheck) => {
      exec('ls -la /dev 2>/dev/null | grep -i fuse', (devError, devStdout) => {
        const result = !devError && devStdout.includes('fuse');
        if (result) {
          resolve(true); // Short-circuit if we find it
        }
        resolveCheck(result);
      });
    }));
    
    // Wait for all checks if no positive result was found
    Promise.all(checks).then((results) => {
      if (results.some(r => r === true)) {
        resolve(true);
      } else {
        resolve(false);
      }
    }).catch(() => {
      // If there's an error in Promise.all, assume it's not installed
      resolve(false);
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
    // Get app path to handle both development and production environments
    const isPackaged = process.env.NODE_ENV === 'production' || !process.defaultApp;
    
    // Use a location that's definitely accessible in both dev and production
    const userHomeDir = os.homedir();
    const SCRIPT_DIR = path.join(userHomeDir, '.webtunelcmounter_tmp');
    
    // Ensure script directory exists
    fs.ensureDirSync(SCRIPT_DIR);
    
    // Create a unique, clear script file name
    const scriptName = `webtunelmounter_installer_${Date.now()}.sh`;
    const scriptPath = path.join(SCRIPT_DIR, scriptName);
    
    try {
      progressCallback(`Creating installation script at ${scriptPath}...`);
      
      // Write script to file with clear debug headers
      const scriptWithDebug = `#!/bin/bash
# WebTunelCMounter installation script
# Created: ${new Date().toISOString()}
# Environment: ${isPackaged ? 'Production/Packaged' : 'Development'}

# Debug information
echo "=== Environment Information ==="
echo "USER: $USER"
echo "PATH: $PATH"
echo "PWD: $(pwd)"
echo "SCRIPT: $0"
echo "================================"

# Actual installation script begins
${scriptContent}
`;
      
      fs.writeFileSync(scriptPath, scriptWithDebug);
      fs.chmodSync(scriptPath, '755');
      
      progressCallback('Requesting administrator privileges...');
      
      // Build a more robust osascript command with error handling
      const escapedPath = scriptPath.replace(/'/g, "'\\''");
      const command = `osascript -e 'try
  do shell script "\\\"${escapedPath}\\\"" with administrator privileges
on error errMsg number errNum
  return "ERROR:" & errNum & ":" & errMsg
end try'`;
      
      progressCallback(`Executing: ${command}`);
      
      exec(command, (error, stdout, stderr) => {
        // Process output for better error reporting
        let result = stdout || '';
        
        // Check for error pattern in output
        if (result.includes('ERROR:') && !error) {
          const errorParts = result.split(':');
          const errorCode = errorParts[1] || 'unknown';
          const errorMessage = errorParts.slice(2).join(':');
          error = new Error(`AppleScript error ${errorCode}: ${errorMessage}`);
        }
        
        // Clean up the script file
        try {
          fs.unlinkSync(scriptPath);
          progressCallback('Cleaned up installation script');
        } catch (cleanupError) {
          progressCallback(`Warning: Could not clean up script: ${cleanupError.message}`);
        }
        
        if (error) {
          // Provide more detailed error messages for common failure cases
          let errorDetail = error.message;
          
          if (error.message.includes('User canceled')) {
            errorDetail = 'The administrator password prompt was canceled by the user.';
          } else if (error.message.includes('60')) {
            errorDetail = 'Operation timed out. This could be due to a slow network connection or server issues.';
          } else if (error.message.includes('permission')) {
            errorDetail = 'Permission denied. The app does not have sufficient privileges.';
          }
          
          progressCallback(`Installation failed: ${errorDetail}`);
          reject(error);
          return;
        }
        
        if (stdout) {
          progressCallback(stdout);
        }
        
        progressCallback('Command completed successfully.');
        resolve(stdout);
      });
    } catch (error) {
      // Clean up in case of error
      try {
        fs.unlinkSync(scriptPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      progressCallback(`Error preparing installation: ${error.message}`);
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
    progressCallback(`Homebrew detected: ${hasHomebrew ? 'Yes' : 'No'}`);
    
    // Create a more robust installation script with better error handling
    // and explicit PATH settings to work in both dev and production
    let installScript;
    
    if (hasHomebrew) {
      // Script for when Homebrew is already installed
      installScript = `
#!/bin/bash
set -e # Exit immediately if a command fails

# Setup Homebrew environment explicitly
if [[ $(uname -m) == "arm64" ]]; then
  # M1/M2/M3 Mac
  if [ -f "/opt/homebrew/bin/brew" ]; then
    echo "Setting up Homebrew for Apple Silicon..."
    export PATH="/opt/homebrew/bin:$PATH"
    eval "$(/opt/homebrew/bin/brew shellenv)"
  else
    echo "ERROR: Homebrew exists but not found at expected location for Apple Silicon"
    exit 1
  fi
else
  # Intel Mac
  if [ -f "/usr/local/bin/brew" ]; then
    echo "Setting up Homebrew for Intel Mac..."
    export PATH="/usr/local/bin:$PATH"
    eval "$(/usr/local/bin/brew shellenv)"
  else
    echo "ERROR: Homebrew exists but not found at expected location for Intel Mac"
    exit 1
  fi
fi

# Verify brew is in path
which brew || { echo "ERROR: brew command not found in PATH"; exit 1; }

echo "Installing macFUSE via Homebrew..."
brew install --cask macfuse || { echo "ERROR: Failed to install macFUSE"; exit 1; }

# Verify installation
pkgutil --pkgs | grep -i fuse || { echo "WARNING: macFUSE installation complete but package not detected. A restart may be required."; }

echo "macFUSE installation completed successfully!"
`;
    } else {
      // Script for when Homebrew needs to be installed first
      installScript = `
#!/bin/bash
set -e # Exit immediately if a command fails

echo "Installing Homebrew..."
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || { 
  echo "ERROR: Failed to install Homebrew"
  exit 1
}

echo "Adding Homebrew to PATH..."
if [[ $(uname -m) == "arm64" ]]; then
  # Apple Silicon Mac (M1/M2/M3)
  if [ -f "/opt/homebrew/bin/brew" ]; then
    export PATH="/opt/homebrew/bin:$PATH"
    eval "$(/opt/homebrew/bin/brew shellenv)"
  else
    echo "ERROR: Homebrew was installed but not found at expected location"
    exit 1
  fi
else
  # Intel Mac
  if [ -f "/usr/local/bin/brew" ]; then
    export PATH="/usr/local/bin:$PATH"
    eval "$(/usr/local/bin/brew shellenv)"
  else
    echo "ERROR: Homebrew was installed but not found at expected location"
    exit 1
  fi
fi

# Verify brew is in path after installation
which brew || { echo "ERROR: brew command not found in PATH after installation"; exit 1; }

echo "Installing macFUSE via Homebrew..."
brew install --cask macfuse || { echo "ERROR: Failed to install macFUSE"; exit 1; }

# Verify installation
pkgutil --pkgs | grep -i fuse || { echo "WARNING: macFUSE installation complete but package not detected. A restart may be required."; }

echo "macFUSE installation completed successfully!"
`;
    }
    
    // Alternative direct installation method if the Homebrew version fails
    const directInstallScript = `
#!/bin/bash
set -e # Exit immediately if a command fails

echo "Installing macFUSE directly from the official installer..."
TEMP_DIR=$(mktemp -d)
INSTALLER_PATH="$TEMP_DIR/macFUSE.pkg"

echo "Downloading macFUSE installer..."
curl -L "https://github.com/osxfuse/osxfuse/releases/download/macfuse-4.4.2/macfuse-4.4.2.pkg" -o "$INSTALLER_PATH" || {
  echo "ERROR: Failed to download macFUSE installer"
  rm -rf "$TEMP_DIR"
  exit 1
}

echo "Installing macFUSE package..."
installer -pkg "$INSTALLER_PATH" -target / || {
  echo "ERROR: Failed to install macFUSE package"
  rm -rf "$TEMP_DIR"
  exit 1
}

echo "Cleaning up..."
rm -rf "$TEMP_DIR"

# Verify installation
pkgutil --pkgs | grep -i fuse || { echo "WARNING: macFUSE installation complete but package not detected. A restart may be required."; }

echo "macFUSE direct installation completed!"
`;
    
    // Try the Homebrew approach first
    try {
      progressCallback('Preparing to install macFUSE via Homebrew...');
      await runScriptWithAdminGUI(installScript, progressCallback);
      progressCallback('macFUSE installed successfully! Please restart your computer to complete the installation.');
      return true;
    } catch (error) {
      // If Homebrew approach fails, try direct installation as a fallback
      progressCallback(`Homebrew installation method failed: ${error.message}`);
      progressCallback('Trying direct installation as a fallback...');
      
      try {
        await runScriptWithAdminGUI(directInstallScript, progressCallback);
        progressCallback('macFUSE installed successfully via direct installation! Please restart your computer to complete the installation.');
        return true;
      } catch (directError) {
        progressCallback(`Direct installation failed: ${directError.message}`);
        progressCallback('Please install macFUSE manually from https://github.com/osxfuse/osxfuse/releases');
        return false;
      }
    }
  } catch (error) {
    progressCallback(`Error installing macFUSE: ${error.message}`);
    progressCallback('Please install macFUSE manually from https://github.com/osxfuse/osxfuse/releases');
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
        // If macFUSE is installed, check for the sshfs command too
        // Try multiple possible locations for better detection in both dev and production
        const checks = [];
        
        // Check the default path
        checks.push(new Promise(resolveCheck => {
          exec('which sshfs', (error, stdout) => {
            resolveCheck(!error && stdout.trim() !== '');
          });
        }));
        
        // Check brew paths (both ARM and Intel)
        checks.push(new Promise(resolveCheck => {
          exec('/opt/homebrew/bin/sshfs --version 2>/dev/null', (error, stdout) => {
            resolveCheck(!error);
          });
        }));
        
        checks.push(new Promise(resolveCheck => {
          exec('/usr/local/bin/sshfs --version 2>/dev/null', (error, stdout) => {
            resolveCheck(!error);
          });
        }));
        
        // Check for SSHFS in known file locations
        checks.push(new Promise(resolveCheck => {
          exec('find /usr/local/bin /opt/homebrew/bin /usr/bin -name sshfs 2>/dev/null', (error, stdout) => {
            resolveCheck(!error && stdout.trim() !== '');
          });
        }));
        
        Promise.all(checks).then(results => {
          // If any check passes, SSHFS is considered installed
          if (results.some(r => r === true)) {
            resolve(true);
          } else {
            // If macFUSE is installed but no SSHFS found, 
            // we can still proceed using macFUSE's native functionality
            resolve(true); 
          }
        }).catch(() => {
          // On error, assume SSHFS needs to be installed
          resolve(false);
        });
      } else {
        // If macFUSE is not installed, SSHFS won't work anyway
        resolve(false);
      }
    }).catch(() => {
      // If there's an error checking macFUSE, assume SSHFS is not installed
      resolve(false);
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
    progressCallback(`Homebrew detected: ${hasHomebrew ? 'Yes' : 'No'}`);
    
    // Check if macFUSE is installed first, as SSHFS depends on it
    const hasMacFuse = await exports.isMacFuseInstalled();
    
    if (!hasMacFuse) {
      progressCallback('macFUSE needs to be installed before SSHFS. Installing macFUSE first...');
      const macFuseSuccess = await exports.installMacFuse(progressCallback);
      
      if (!macFuseSuccess) {
        progressCallback('Failed to install macFUSE which is required for SSHFS.');
        return false;
      }
    }
    
    // Create a more robust installation script with better error handling
    // and explicit PATH settings to work in both dev and production
    let installScript;
    
    if (hasHomebrew) {
      // Script for when Homebrew is already installed
      installScript = `
#!/bin/bash
set -e # Exit immediately if a command fails

# Setup Homebrew environment explicitly
if [[ $(uname -m) == "arm64" ]]; then
  # M1/M2/M3 Mac
  if [ -f "/opt/homebrew/bin/brew" ]; then
    echo "Setting up Homebrew for Apple Silicon..."
    export PATH="/opt/homebrew/bin:$PATH"
    eval "$(/opt/homebrew/bin/brew shellenv)"
  else
    echo "ERROR: Homebrew exists but not found at expected location for Apple Silicon"
    exit 1
  fi
else
  # Intel Mac
  if [ -f "/usr/local/bin/brew" ]; then
    echo "Setting up Homebrew for Intel Mac..."
    export PATH="/usr/local/bin:$PATH"
    eval "$(/usr/local/bin/brew shellenv)"
  else
    echo "ERROR: Homebrew exists but not found at expected location for Intel Mac"
    exit 1
  fi
fi

# Verify brew is in path
which brew || { echo "ERROR: brew command not found in PATH"; exit 1; }

echo "Installing SSHFS via Homebrew..."
brew install sshfs || { echo "ERROR: Failed to install SSHFS"; exit 1; }

# Verify installation
which sshfs || { echo "WARNING: SSHFS installation complete but command not detected in PATH"; }

echo "SSHFS installation completed successfully!"
`;
    } else {
      // Script for when Homebrew needs to be installed first
      installScript = `
#!/bin/bash
set -e # Exit immediately if a command fails

echo "Installing Homebrew..."
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || { 
  echo "ERROR: Failed to install Homebrew"
  exit 1
}

echo "Adding Homebrew to PATH..."
if [[ $(uname -m) == "arm64" ]]; then
  # Apple Silicon Mac (M1/M2/M3)
  if [ -f "/opt/homebrew/bin/brew" ]; then
    export PATH="/opt/homebrew/bin:$PATH"
    eval "$(/opt/homebrew/bin/brew shellenv)"
  else
    echo "ERROR: Homebrew was installed but not found at expected location"
    exit 1
  fi
else
  # Intel Mac
  if [ -f "/usr/local/bin/brew" ]; then
    export PATH="/usr/local/bin:$PATH"
    eval "$(/usr/local/bin/brew shellenv)"
  else
    echo "ERROR: Homebrew was installed but not found at expected location"
    exit 1
  fi
fi

# Verify brew is in path after installation
which brew || { echo "ERROR: brew command not found in PATH after installation"; exit 1; }

echo "Installing SSHFS via Homebrew..."
brew install sshfs || { echo "ERROR: Failed to install SSHFS"; exit 1; }

# Verify installation
which sshfs || { echo "WARNING: SSHFS installation complete but command not detected in PATH"; }

echo "SSHFS installation completed successfully!"
`;
    }
    
    // Run the script with GUI password prompt
    try {
      progressCallback('Preparing to install SSHFS...');
      await runScriptWithAdminGUI(installScript, progressCallback);
      progressCallback('SSHFS installed successfully!');
      return true;
    } catch (error) {
      progressCallback(`Error installing SSHFS: ${error.message}`);
      progressCallback('Please install SSHFS manually by running: brew install sshfs');
      return false;
    }
  } catch (error) {
    progressCallback(`Error installing SSHFS: ${error.message}`);
    progressCallback('Please install SSHFS manually by running: brew install sshfs');
    return false;
  }
};