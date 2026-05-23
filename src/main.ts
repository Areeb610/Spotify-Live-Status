import { app, Tray, Menu, nativeImage } from "electron";
import path from "path";
import { Client } from "@xhayper/discord-rpc";
import { WebSocketServer } from "ws";

app.setAppUserModelId("com.spotify-live-status");

// Prevent the app from quitting when all windows are closed
app.on("window-all-closed", () => { /* keep running in tray */ });

let tray: Tray | null = null;

// ── Discord RPC state ────────────────────────────────────────────────────────

const client = new Client({ clientId: "1504101920539672597" });
const RPC_COOLDOWN_MS = 4000;

let lastActivityHash = "";
let lastStartTimestamp = 0;
let lastRpcCallTime = 0;
let pendingUpdate: any = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let updating = false;
let rpcReady = false;
let wsClients = 0;

function setStatus(label: string) {
  tray?.setToolTip(`Spotify Live Status — ${label}`);
  buildMenu(label);
}

function buildMenu(status: string) {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Status: ${status}`, enabled: false },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ])
  );
}

function activityHash(data: any): string {
  return `${data.songId}|${data.artistId}|${data.albumId}|${data.line}`;
}

function buildActivity(data: any, startTimestamp: number, endTimestamp: number) {
  const hdArt = data.art ? data.art.replace("00001e02", "00001e01") : data.art;
  const proxiedImage = hdArt
    ? `https://wsrv.nl/?url=${encodeURIComponent(hdArt)}&w=640&h=640&fit=cover`
    : "spotify";

  const buttons: { label: string; url: string }[] = [];
  if (data.songId)
    buttons.push({ label: "▶ Play on Spotify", url: `https://open.spotify.com/track/${data.songId}` });
  if (data.albumId)
    buttons.push({ label: "💿 View Album", url: `https://open.spotify.com/album/${data.albumId}` });
  if (data.artistId && buttons.length < 2)
    buttons.push({ label: "🎵 View Artist", url: `https://open.spotify.com/artist/${data.artistId}` });

  const line = data.line?.split("\n")[0]?.trim();
  const state =
    line && line.length > 1
      ? line.length > 128 ? line.slice(0, 125) + "…" : line
      : `by ${data.artistName}`;

  return {
    details: data.song,
    state,
    largeImageKey: proxiedImage,
    largeImageText: data.albumName || data.song,
    smallImageKey: "spotify",
    smallImageText: "Spotify",
    startTimestamp,
    endTimestamp,
    buttons,
    type: 2,
  };
}

function schedulePending(delayMs: number) {
  if (pendingTimer !== null) return;
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    const next = pendingUpdate;
    pendingUpdate = null;
    if (next) updateRPC(next);
  }, delayMs);
}

async function updateRPC(data: any) {
  if (!data?.song || !rpcReady) return;

  const position: number = data.position ?? 0;
  const length: number = data.length ?? 0;
  if (length === 0) return;

  const now = Date.now();
  const nowSec = Math.floor(now / 1000);
  const startTimestamp = nowSec - Math.floor(position);
  const endTimestamp = startTimestamp + Math.floor(length);

  const h = activityHash(data);
  const isNewActivity = h !== lastActivityHash;

  if (!isNewActivity && Math.abs(startTimestamp - lastStartTimestamp) < 4) return;

  const msSinceLastCall = now - lastRpcCallTime;
  const cooldownRemaining = RPC_COOLDOWN_MS - msSinceLastCall;

  if (cooldownRemaining > 0 || updating) {
    pendingUpdate = data;
    if (cooldownRemaining > 0) schedulePending(cooldownRemaining);
    return;
  }

  updating = true;
  if (isNewActivity) lastActivityHash = h;
  lastStartTimestamp = startTimestamp;
  lastRpcCallTime = now;

  try {
    await client.user?.setActivity(buildActivity(data, startTimestamp, endTimestamp));
    setStatus(`Playing: ${data.song}`);
  } catch (err) {
    console.error("RPC update failed:", err);
    lastActivityHash = "";
  } finally {
    updating = false;
    if (pendingUpdate) {
      const next = pendingUpdate;
      pendingUpdate = null;
      setImmediate(() => updateRPC(next));
    }
  }
}

// ── WebSocket server ─────────────────────────────────────────────────────────

function startWebSocketServer() {
  const wss = new WebSocketServer({ port: 8080 });

  wss.on("listening", () => {
    console.log("WebSocket server on ws://localhost:8080");
    setStatus("Waiting for browser…");
  });

  wss.on("connection", (ws) => {
    wsClients++;
    console.log("Browser connected");
    setStatus("Browser connected — waiting for track");

    ws.on("message", async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.paused) {
          lastActivityHash = "";
          await client.user?.clearActivity();
          setStatus("Paused");
        } else {
          await updateRPC(data);
        }
      } catch (err) {
        console.error("Bad message:", err);
      }
    });

    ws.on("close", () => {
      wsClients--;
      console.log("Browser disconnected");
      if (wsClients === 0) setStatus("Waiting for browser…");
    });
  });

  wss.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error("Port 8080 already in use — is another instance running?");
      setStatus("Error: port 8080 in use");
    }
  });
}

// ── Electron bootstrap ───────────────────────────────────────────────────────

app.whenReady().then(() => {
  const iconPath = path.join(__dirname, "..", "assets", "tray.png");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip("Spotify Live Status");
  buildMenu("Starting…");

  client.on("ready", () => {
    console.log("Discord RPC connected");
    rpcReady = true;
    setStatus("Discord connected");
    startWebSocketServer();
  });

  client.on("disconnected", () => {
    rpcReady = false;
    setStatus("Discord disconnected — retrying…");
  });

  client.login().catch((err) => {
    console.error("Discord login failed:", err);
    setStatus("Discord login failed");
    // Start WS anyway so we don't block; RPC updates are guarded by rpcReady
    startWebSocketServer();
  });
});

app.on("before-quit", () => {
  client.user?.clearActivity().catch(() => {});
});
