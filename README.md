# spotify-live-status

Show your Spotify status on Discord with **live lyrics support**.

<img width="368" alt="Discord RPC showing current Spotify track with lyrics" src="https://user-images.githubusercontent.com/51315646/229553964-144c10dd-0dcb4c28-92e3-c4d18a2b3b0d.png">

## How it works

- A Tampermonkey userscript runs on `open.spotify.com` and scrapes the current track, album art, and lyrics from the page
- A local Node.js server receives that data over WebSocket and pushes it to Discord via Rich Presence

## Requirements

- [Discord](https://discord.com) (desktop app)
- [Node.js](https://nodejs.org) v18 or later
- [Tampermonkey](https://www.tampermonkey.net) browser extension

## Setup

### 1. Install the userscript

Open [browser.js](browser.js), copy the contents, then in Tampermonkey click **Create a new script**, paste it in, and save.

### 2. Run the server

**Option A — Pre-built (recommended, no TypeScript needed)**

Download the latest `index.js` from the [Releases](../../releases) page, then:

```bash
node index.js
```

**Option B — Build from source**

```bash
git clone https://github.com/lonelil/spotify-live-status
cd spotify-live-status
npm install
npx tsc
node dist/index.js
```

### 3. Start listening

1. Open Discord (must be running before the server starts)
2. Open [open.spotify.com](https://open.spotify.com) and play a track
3. Open the **lyrics panel** and **expand the album art** for best results

<img width="205" alt="Spotify with lyrics panel and expanded album art" src="https://user-images.githubusercontent.com/51315646/229554905-24b342ca-46b4-4b47-bb38-5c389395a262.png">

Your Discord status will update automatically within a few seconds.

## Tips

- Keep the server running in the background while you use Spotify
- The lyrics line shown in Discord updates in real time as the song plays
- If your status stops updating, refresh the Spotify tab
