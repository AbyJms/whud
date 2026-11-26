# WhatsApp HUD

A lightweight desktop overlay for accessing WhatsApp conversations without switching windows.

This project started with a simple idea: **I wanted to keep track of WhatsApp messages while gaming without constantly Alt-Tabbing out of my game.**

WhatsApp HUD brings the currently active WhatsApp Web conversation into a compact, transparent, always-on-top desktop window. It also allows messages to be sent directly from the overlay.

## Features

- **Live Conversation Sync** – Mirrors the currently selected WhatsApp Web conversation.
- **Message Display** – Displays incoming and outgoing messages.
- **Quick Replies** – Send messages directly from the HUD.
- **Contact Status** – Displays online and typing indicators.
- **Media Recognition** – Identifies images, videos, GIFs, stickers, voice messages, and view-once messages.
- **Floating Overlay** – Transparent, frameless, and always on top.
- **Click-through Mode** – Allows interaction with applications behind the HUD.
- **Smart Scrolling** – Automatically follows new messages while preserving manual scrolling.

## Tech Stack

- Electron
- React
- TypeScript
- electron-vite
- JavaScript Browser Extension (Manifest V3)
- Chrome Native Messaging

## Architecture

The application consists of three main components:

- **Electron Application:** Manages the desktop window, overlay behaviour, and user interface.
- **Browser Extension:** Extracts conversation data from WhatsApp Web and handles message sending.
- **Native Messaging Host:** Facilitates communication between the browser extension and the Electron application.

## Roadmap : Future SCope

### Chat Navigation

- Browse and access all WhatsApp conversations from the HUD.
- Switch between individual and group chats without opening WhatsApp Web.
- Search for contacts and conversations.
- Display unread message indicators.

### Message Compatibility

- Proper emoji rendering.
- Improved sticker support.
- Support for replies and quoted messages.
- Better previews for images, videos, GIFs, and voice messages.
- Improved handling of forwarded messages and group conversations.

### Notifications and Customization

- Desktop notifications for incoming messages.
- Unread message counts.
- Customizable HUD position, size, and opacity.
- Configurable keyboard shortcuts.
- Option to launch the HUD automatically at system startup.

### Further Improvements

- More reliable synchronization and message handling.
- Better handling of WhatsApp Web updates.
- Cross-platform support beyond Windows.

## Installation

### Requirements

- Windows 10 or later
- Node.js and npm
- Brave or another compatible Chromium-based browser
- WhatsApp Web

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/whatsapp-hud.git
cd whatsapp-hud
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the application

```bash
npm run dev
```

### 4. Install the browser extension

1. Navigate to `brave://extensions` in Brave.
2. Enable Developer mode.
3. Select **Load unpacked**.
4. Choose the project's `extension` directory.
5. Copy the extension ID displayed on the extensions page.
6. Open WhatsApp Web and sign in.

### 5. Configure Native Messaging

Build the native messaging host from the project root:

```bash
npx @yao-pkg/pkg native-bridge/host.js --targets node22-win-x64 --output native-bridge/host.exe
```

Create `native-bridge/com.whatsapp.hud.json`:

```json
{
  "name": "com.whatsapp.hud",
  "description": "WhatsApp Desktop HUD Native Messaging Host",
  "path": "ABSOLUTE_PATH_TO_HOST_EXE",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://YOUR_EXTENSION_ID/"]
}
```

Replace the executable path and extension ID with your local values.

Register the manifest under the following Windows registry key:

```text
HKEY_CURRENT_USER\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.whatsapp.hud
```

Set its default value to the absolute path of `com.whatsapp.hud.json`, then restart Brave.

## Keyboard Shortcuts

| Shortcut          | Action                                   |
| ----------------- | ---------------------------------------- |
| `Alt + Shift + H` | Show or hide the HUD                     |
| `Alt + Shift + I` | Toggle interactive or click-through mode |

## Building

To build the Windows application:

```bash
npm run build:win
```

## Current Limitations

- WhatsApp Web must remain open for conversation synchronization.
- The extension relies on WhatsApp Web's DOM structure and may require updates when it changes.
- Media messages are currently represented using placeholders.
- Native messaging configuration currently targets Windows.

## Disclaimer

WhatsApp HUD is an independent personal project and is not affiliated with, endorsed by, or officially connected to WhatsApp or Meta.
