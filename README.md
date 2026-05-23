# Spotify Live Status

Automatically show what you're listening to on Spotify directly in your Discord status — including the **live lyric line** as it plays.

![Discord RPC showing current Spotify track with lyrics](assets/spotify_live_status_example.png)

> **Heads up:** Live lyrics depend on the Spotify web player's lyrics panel being open. Fast or instrumental tracks may not display a lyric line.

## What it does

Opens Spotify in your browser, plays a song, and your Discord status updates automatically — showing the track name, artist, album art, and the current lyric. No Spotify account API keys or developer setup required.

Everything runs locally on your machine. No data is sent anywhere except to Discord (to update your status) and Spotify (to open the web player).

## Requirements

- [Discord](https://discord.com) desktop app
- [Tampermonkey](https://www.tampermonkey.net) browser extension

## Setup

### 1. Install the app

Download the latest version from the [Releases](../../releases/latest) page:

- **Windows** — run `Spotify Live Status Setup.exe`
  > Windows may show a "Windows protected your PC" warning. Click **More info** → **Run anyway**. This happens because the app isn't commercially signed — the source code is fully open and auditable above.
- **macOS** — open `Spotify Live Status.dmg` and drag to Applications
  > macOS may block it on first launch. Go to **System Settings → Privacy & Security** and click **Open Anyway**.

The app runs in the background and shows up in your system tray.

### 2. Add the browser script (one-time)

The app needs a small browser script to read your currently playing track from the Spotify web player.

1. Install [Tampermonkey](https://www.tampermonkey.net) for [Chrome](https://www.tampermonkey.net), [Edge](https://www.tampermonkey.net), or [Firefox](https://www.tampermonkey.net) if you don't have it
2. Open [browser.js](browser.js) in this repo, click **Raw**, and copy everything
3. In Tampermonkey, click **Create a new script**, paste it in, and save with **Ctrl+S**

This script only runs on `open.spotify.com` and only sends your currently playing track info to the app on your own computer.

### 3. Play something

1. Open Discord
2. Open [open.spotify.com](https://open.spotify.com) and play a track
3. For lyrics to show, open the **lyrics panel** in the Spotify player

Your Discord status will update within a few seconds. The tray icon shows the current state.

## Tips

- Right-click the tray icon → **Quit** to stop the app
- If your status stops updating, try refreshing the Spotify tab
- The app needs to be running before you open Spotify for best results

## Build from source

```bash
git clone https://github.com/Areeb-Saqib/Spotify-Live-Status
cd Spotify-Live-Status
npm install
npm run dev     # run without packaging
npm run dist    # build installer
```

Requires [Node.js](https://nodejs.org) v22+ and [Git](https://git-scm.com).

## Credits

Based on the original project by [lonelil](https://github.com/lonelil) — [lonelil/spotify-live-status](https://github.com/lonelil/spotify-live-status).
