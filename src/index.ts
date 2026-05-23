import { Client } from "@xhayper/discord-rpc";
import { WebSocketServer } from "ws";

const client = new Client({ clientId: "1504101920539672597" });
const wss = new WebSocketServer({ port: 8080 });

const RPC_COOLDOWN_MS = 4000; // Discord allows 5 updates per 20s

let lastActivityHash = "";
let lastStartTimestamp = 0;
let lastRpcCallTime = 0;
let pendingUpdate: any = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let updating = false;

console.log("Starting Spotify RPC server...");

wss.on("listening", () => console.log("WebSocket on ws://localhost:8080"));

function activityHash(data: any): string {
  return `${data.songId}|${data.artistId}|${data.albumId}|${data.line}`;
}

function buildActivity(
  data: any,
  startTimestamp: number,
  endTimestamp: number,
) {
  const hdArt = data.art ? data.art.replace("00001e02", "00001e01") : data.art;
  const proxiedImage = hdArt
    ? `https://wsrv.nl/?url=${encodeURIComponent(hdArt)}&w=640&h=640&fit=cover`
    : "spotify";

  const buttons: { label: string; url: string }[] = [];
  if (data.songId)
    buttons.push({
      label: "▶ Play on Spotify",
      url: `https://open.spotify.com/track/${data.songId}`,
    });
  if (data.albumId)
    buttons.push({
      label: "💿 View Album",
      url: `https://open.spotify.com/album/${data.albumId}`,
    });
  if (data.artistId && buttons.length < 2)
    buttons.push({
      label: "🎵 View Artist",
      url: `https://open.spotify.com/artist/${data.artistId}`,
    });

  const line = data.line?.split("\n")[0]?.trim();
  const state =
    line && line.length > 1
      ? line.length > 128
        ? line.slice(0, 125) + "…"
        : line
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
  if (pendingTimer !== null) return; // already scheduled
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    const next = pendingUpdate;
    pendingUpdate = null;
    if (next) updateRPC(next);
  }, delayMs);
}

async function updateRPC(data: any) {
  if (!data?.song) return;

  const position: number = data.position ?? 0;
  const length: number = data.length ?? 0;
  if (length === 0) return;

  const now = Date.now();
  const nowSec = Math.floor(now / 1000);
  const startTimestamp = nowSec - Math.floor(position);
  const endTimestamp = startTimestamp + Math.floor(length);

  const h = activityHash(data);
  const isNewActivity = h !== lastActivityHash;

  // Drop pure position ticks that haven't drifted enough to matter.
  if (!isNewActivity && Math.abs(startTimestamp - lastStartTimestamp) < 4)
    return;

  const msSinceLastCall = now - lastRpcCallTime;
  const cooldownRemaining = RPC_COOLDOWN_MS - msSinceLastCall;

  if (cooldownRemaining > 0 || updating) {
    // Always keep the latest data queued; old pending is superseded.
    pendingUpdate = data;
    // Schedule a retry at the exact moment the cooldown expires.
    // If updating, retry immediately after — the finally block handles that.
    if (cooldownRemaining > 0) schedulePending(cooldownRemaining);
    return;
  }

  updating = true;
  if (isNewActivity) lastActivityHash = h;
  lastStartTimestamp = startTimestamp;
  lastRpcCallTime = now;

  try {
    await client.user?.setActivity(
      buildActivity(data, startTimestamp, endTimestamp),
    );
  } catch (err) {
    console.error("RPC update failed:", err);
    lastActivityHash = "";
  } finally {
    updating = false;
    if (pendingUpdate) {
      const next = pendingUpdate;
      pendingUpdate = null;
      // Cooldown already elapsed since we just called; fire immediately.
      setImmediate(() => updateRPC(next));
    }
  }
}

wss.on("connection", (ws) => {
  console.log("Browser connected");

  ws.on("message", async (message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.paused) {
        lastActivityHash = "";
        await client.user?.clearActivity();
      } else {
        await updateRPC(data);
      }
    } catch (err) {
      console.error("Bad message:", err);
    }
  });

  ws.on("close", () => console.log("Browser disconnected"));
});

client.on("ready", () => console.log("Discord RPC connected"));

client.login();
