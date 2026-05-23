// ==UserScript==
// @name         Spotify Live Status
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Sends Spotify playback state to local Discord RPC server
// @author       lonelil
// @match        https://open.spotify.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=spotify.com
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  let ws;
  let lastPayload = "";
  let intervalId = null;

  function parseTime(t) {
    if (!t || typeof t !== "string") return 0;
    const parts = t.trim().split(":").map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]))
      return parts[0] * 60 + parts[1];
    return 0;
  }

  function getSongEl() {
    return (
      document.querySelector('[data-testid="context-item-link"]') ||
      document.querySelector('[data-testid="now-playing-track-link"]') ||
      document.querySelector('a[href*="/track/"]')
    );
  }

  function getLyricsEl() {
    const el = document.querySelector('.RL7r4lsMHxMySdFr');
    if (el) return el;
    for (const line of document.querySelectorAll('[data-testid="lyrics-line"]')) {
      if (
        !line.classList.contains("aLaX8poOH8kdbmGf") &&
        !line.classList.contains("Mnf9PkrVHsX90BNf") &&
        line.innerText.trim()
      )
        return line;
    }
    return null;
  }

  function getSpotifyData() {
    try {
      const songEl = getSongEl();
      const artistEl = document.querySelector('[data-testid="context-item-info-artist"]');
      const artEl = document.querySelector('[data-testid="cover-art-image"]');
      const durationEl = document.querySelector('[data-testid="playback-duration"]');

      if (!songEl || !artistEl || !artEl || !durationEl) return null;

      const positionEl =
        document.querySelector('[data-testid="playback-position"]') ||
        document.querySelector('.playback-bar__progress-time');

      const albumEl = document.querySelector(
        '[data-testid="now-playing-widget"] a[href*="/album/"]'
      );

      const playButtonEl = document.querySelector('[data-testid="control-button-playpause"]');
      const isPlaying = playButtonEl?.getAttribute("aria-label") === "Pause";

      const trackId = (songEl.href || "").split("/track/")[1]?.split("?")[0] || "";
      const artistId = (artistEl.href || "").split("/artist/")[1]?.split("?")[0] || "";
      const albumId = albumEl ? (albumEl.href || "").split("/album/")[1]?.split("?")[0] || "" : "";

      return {
        song: songEl.innerText.trim(),
        songId: trackId,
        artistName: artistEl.innerText.trim(),
        artistId,
        albumId,
        albumName: albumEl ? albumEl.innerText.trim() : "",
        art: artEl.src,
        length: parseTime(durationEl.innerText),
        position: parseTime(positionEl ? positionEl.innerText : ""),
        line: getLyricsEl()?.innerText.trim().split("\n")[0] || "",
        isPlaying,
      };
    } catch {
      return null;
    }
  }

  function tick() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const data = getSpotifyData();
    if (!data) return;

    const payload = JSON.stringify(data.isPlaying ? data : { paused: true });
    if (payload === lastPayload) return;
    lastPayload = payload;

    ws.send(payload);
  }

  function connect() {
    ws = new WebSocket("ws://localhost:8080");

    ws.onopen = () => {
      console.log("[SpotifyRPC] connected");
      lastPayload = ""; // force resend on reconnect
    };

    ws.onclose = (e) => {
      console.log("[SpotifyRPC] disconnected, reconnecting in 1s...", e.reason);
      setTimeout(connect, 1000);
    };

    ws.onerror = () => ws.close();
  }

  // Single interval outside connect() — no stacking on reconnect
  intervalId = setInterval(tick, 500);
  connect();
})();
