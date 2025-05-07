const fs = require('fs-extra');
const path = require('path');

// Make sure the icons directory exists in the build
const sourceIconsDir = path.join(__dirname, 'src', 'assets', 'icons');
const targetIconsDir = path.join(__dirname, 'dist', 'mac', 'WebtunelCMounter.app', 'Contents', 'Resources', 'app', 'src', 'assets', 'icons');

// Create the directory recursively if it doesn't exist
fs.ensureDirSync(targetIconsDir);

// Copy the icons
fs.copySync(sourceIconsDir, targetIconsDir);

console.log('Icons copied successfully to build directory.');