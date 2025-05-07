const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Define source and destination paths
const sourceIconPath = path.join(__dirname, 'src/assets/icon.png');
const iconsDir = path.join(__dirname, 'src/assets/icons');

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Sizes to generate
const sizes = [16, 32, 64];

// Process each size
async function resizeIcons() {
  for (const size of sizes) {
    try {
      await sharp(sourceIconPath)
        .resize(size, size)
        .toFile(path.join(iconsDir, `icon-${size}.png`));
      console.log(`Created icon-${size}.png`);
    } catch (err) {
      console.error(`Error creating icon-${size}.png:`, err);
    }
  }
}

// Run the resize function
resizeIcons().then(() => {
  console.log('All icons created successfully');
}).catch(err => {
  console.error('Error in resize process:', err);
});