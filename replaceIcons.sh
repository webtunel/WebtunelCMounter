#!/bin/bash

# Replace electron.icns with our custom icon
if [ -f "dist/mac-arm64/WebtunelCMounter.app/Contents/Resources/electron.icns" ]; then
  cp build-resources/icon.icns dist/mac-arm64/WebtunelCMounter.app/Contents/Resources/electron.icns
  echo "Replaced electron.icns in app bundle"
fi

# Also copy to any other locations electron icons might be
if [ -d "dist/mac-arm64/WebtunelCMounter.app/Contents/Resources/app/assets" ]; then
  mkdir -p dist/mac-arm64/WebtunelCMounter.app/Contents/Resources/app/assets
  cp src/assets/icon.png dist/mac-arm64/WebtunelCMounter.app/Contents/Resources/app/assets/
  echo "Copied icon.png to app assets"
fi

echo "Icon replacement complete"