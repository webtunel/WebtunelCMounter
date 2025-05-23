#!/bin/bash

# Create an iconset directory
mkdir -p build-resources/icon.iconset

# Copy the source icon to build-resources
cp src/assets/icon.png build-resources/

# Resize icon to different sizes
sips -z 16 16 src/assets/icon.png --out build-resources/icon.iconset/icon_16x16.png
sips -z 32 32 src/assets/icon.png --out build-resources/icon.iconset/icon_16x16@2x.png
sips -z 32 32 src/assets/icon.png --out build-resources/icon.iconset/icon_32x32.png
sips -z 64 64 src/assets/icon.png --out build-resources/icon.iconset/icon_32x32@2x.png
sips -z 128 128 src/assets/icon.png --out build-resources/icon.iconset/icon_128x128.png
sips -z 256 256 src/assets/icon.png --out build-resources/icon.iconset/icon_128x128@2x.png
sips -z 256 256 src/assets/icon.png --out build-resources/icon.iconset/icon_256x256.png
sips -z 512 512 src/assets/icon.png --out build-resources/icon.iconset/icon_256x256@2x.png
sips -z 512 512 src/assets/icon.png --out build-resources/icon.iconset/icon_512x512.png
sips -z 1024 1024 src/assets/icon.png --out build-resources/icon.iconset/icon_512x512@2x.png

# Convert the iconset to an .icns file
iconutil -c icns build-resources/icon.iconset -o build-resources/icon.icns

echo "Icon created at build-resources/icon.icns"