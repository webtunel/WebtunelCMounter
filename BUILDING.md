# Building WebtunelCMounter

This document provides detailed instructions for building WebtunelCMounter from source.

## Prerequisites

- macOS 10.14 (Mojave) or newer
- Node.js v16 or newer
- npm or yarn

## Development Build

1. Clone the repository:
   ```bash
   git clone https://github.com/webtunel/WebtunelCMounter.git
   cd WebtunelCMounter
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server with hot reloading:
   ```bash
   npm run dev:react
   ```

## Production Build

To create a production build of WebtunelCMounter:

1. Build the React frontend:
   ```bash
   npm run build:webpack
   ```

2. Create the application icon:
   ```bash
   npm run build:icons
   ```

3. Build the Electron application:
   ```bash
   npm run build
   ```

4. The packaged application will be available in the `dist/mac-arm64` directory.

## Creating a DMG Installer

To create a distributable DMG file:

```bash
npm run dist
```

The DMG file will be created in the `dist` directory.

## Build Configuration

WebtunelCMounter uses electron-builder for creating distributable packages. The configuration is specified in:

1. `package.json` under the `"build"` key
2. `electron-builder.yml` for more complex configurations

## Known Build Issues and Solutions

### Code Signing Errors

When building on macOS, you might encounter code signing errors like:

```
Command failed: codesign --sign ... /path/to/locale.pak
No such file or directory
```

#### Solution:

Build with code signing disabled by adding `--config.mac.identity=null` to the build command:

```bash
npm run build -- --config.mac.identity=null
npm run dist -- --config.mac.identity=null
```

Or modify your package.json to always disable code signing:

```json
"scripts": {
  "build": "npm run build:webpack && npm run build:icons && electron-builder --dir -c electron-builder.yml --config.mac.identity=null && npm run replace:icons",
  "dist": "npm run build:icons && electron-builder -c electron-builder.yml --config.mac.identity=null && npm run replace:icons"
}
```

### Signing for Distribution

If you need to sign the application for distribution:

1. Obtain an Apple Developer certificate
2. Use `electron-builder` with your certificate:
   ```bash
   npm run dist -- --config.mac.identity="Developer ID Application: Your Name (TEAM_ID)"
   ```

## Customizing the Build

### Application Metadata

Update the application metadata in `package.json`:

```json
{
  "name": "WebtunelCMounter",
  "version": "1.0.0",
  "description": "Mount FTP, SFTP, Samba and other protocols on macOS",
  "build": {
    "appId": "com.webtunel.webtunelcmounter",
    "productName": "WebtunelCMounter"
  }
}
```

### Icon Customization

1. Replace the icon source in `src/assets/icon.png`
2. Run `npm run build:icons` to generate the `.icns` file
3. The `replaceIcons.sh` script will automatically use your custom icon in the built application

## Troubleshooting

### Application Crashes During Build

If the application crashes during the build process:

1. Check Electron and dependency versions for compatibility
2. Verify that all required native dependencies are correctly installed
3. Look for errors in the build logs

### Missing Dependencies

If you see errors about missing dependencies:

1. Ensure all dependencies are installed: `npm install`
2. For native dependencies, you may need to install additional build tools: `xcode-select --install`

### Icon Issues

If icons aren't displaying correctly in the built application:

1. Make sure the icon source file is a high-quality PNG
2. Verify that the `build:icons` and `replace:icons` scripts ran successfully
3. Check if the custom icon files were properly copied to the application bundle