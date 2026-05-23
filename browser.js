// ==UserScript==
// @name         Spotify Live Status
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Sends Spotify playback state to local Discord RPC server
// @author       lonelil
// @match        https://open.spotify.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=spotify.com
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  let lastPayload = "";
  let ws;

  function getSpotifyData() {
    try {
      // Try multiple selectors for song link as Spotify changes their DOM
      let songEl = document.querySelector(`[data-testid="context-item-link"]`);
      if (!songEl) {
        songEl = document.querySelector('a[href*="/track/"]');
      }
      if (!songEl) {
        songEl = document.querySelector(
          '[data-testid="now-playing-track-link"]',
        );
      }
      // Additional fallback: look for any link containing track in href that's not the album link
      if (!songEl) {
        const allLinks = document.querySelectorAll('a[href*="/track/"]');
        for (const link of allLinks) {
          if (!link.href.includes("/album/")) {
            songEl = link;
            break;
          }
        }
      }
      const artistEl = document.querySelector(
        `[data-testid="context-item-info-artist"]`,
      );
      const artEl = document.querySelector(`[data-testid="cover-art-image"]`);
      const durationEl = document.querySelector(
        `[data-testid="playback-duration"]`,
      );
      // Try multiple selectors for position as Spotify might have changed their DOM
      let positionEl = document.querySelector(
        `[data-testid="playback-position"]`,
      );
      if (!positionEl) {
        positionEl = document.querySelector(
          `span[data-testid="playback-position"]`,
        );
      }
      if (!positionEl) {
        positionEl = document.querySelector(`.playback-bar__progress-time`);
      }
      // Find the active lyric line.
      // Spotify marks the current line with "RL7r4lsMHxMySdFr", past lines with "aLaX8poOH8kdbmGf",
      // and future lines with "Mnf9PkrVHsX90BNf".
      // Try multiple approaches to find the current lyric line
      let lyricsEl = document.querySelector(
        '[data-testid="lyrics-line"].RL7r4lsMHxMySdFr',
      );

      // Fallback: look for any element with the current line class
      if (!lyricsEl) {
        lyricsEl = document.querySelector(".RL7r4lsMHxMySdFr");
      }

      // Additional fallback: look for the first lyric line that doesn't have past/future classes
      if (!lyricsEl) {
        const allLyrics = document.querySelectorAll(
          '[data-testid="lyrics-line"]',
        );
        for (const line of allLyrics) {
          if (
            !line.classList.contains("aLaX8poOH8kdbmGf") &&
            !line.classList.contains("Mnf9PkrVHsX90BNf") &&
            line.innerText.trim()
          ) {
            lyricsEl = line;
            break;
          }
        }
      }

      // album link lives on the cover art's parent anchor
      const albumEl = document.querySelector(
        `[data-testid="now-playing-widget"] a[href*="/album/"]`,
      );

      const playButtonEl = document.querySelector('[data-testid="control-button-playpause"]');
      const isPlaying = playButtonEl?.getAttribute("aria-label") === "Pause";

      if (!songEl || !artistEl || !artEl || !durationEl) return null; // Allow positionEl to be null

      // Debug: log what we're getting from the DOM
      const durationText = durationEl.innerText;
      const positionText = positionEl ? positionEl.innerText : "undefined";

      const trackHref = songEl.href || "";
      const artistHref = artistEl.href || "";
      const albumHref = albumEl ? albumEl.href : "";

      // extract IDs from spotify URIs like /track/abc123 or /artist/abc123
      const trackId = trackHref.split("/track/")[1]?.split("?")[0] || "";
      const artistId = artistHref.split("/artist/")[1]?.split("?")[0] || "";
      const albumId = albumHref.split("/album/")[1]?.split("?")[0] || "";

      // parse "m:ss" positions into total seconds
      function parseTime(t) {
        if (!t || typeof t !== "string") return 0;
        const parts = t.trim().split(":").map(Number);
        // Handle both "m:ss" and "mm:ss" formats
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          return parts[0] * 60 + parts[1];
        }
        return 0;
      }

      return {
        song: songEl.innerText.trim(),
        songId: trackId,
        artistName: artistEl.innerText.trim(),
        artistId,
        albumId,
        albumName: albumEl ? albumEl.innerText.trim() : "",
        art: artEl.src,
        length: parseTime(durationEl.innerText),
        position: parseTime(positionEl.innerText),
        line: lyricsEl ? lyricsEl.innerText.trim().split("\n")[0] : "",
        isPlaying,
      };
    } catch (e) {
      return null;
    }
  }

  function connect() {
    ws = new WebSocket("ws://localhost:8080");

    ws.onopen = function () {
      console.log("[SpotifyRPC] connected");

      setInterval(function () {
        if (ws.readyState !== WebSocket.OPEN) {
          console.log(
            "[SpotifyRPC] WebSocket not ready, state:",
            ws.readyState,
          );
          return;
        }

        const data = getSpotifyData();
        if (!data) {
          console.log("[SpotifyRPC] No data returned from getSpotifyData()");
          return;
        }

        const payload = JSON.stringify(data.isPlaying ? data : { paused: true });
        if (payload === lastPayload) return;
        lastPayload = payload;

        ws.send(payload);
      }, 100);
    };

    ws.onclose = function (e) {
      console.log("[SpotifyRPC] disconnected, reconnecting in 1s...", e.reason);
      setTimeout(connect, 1000);
    };

    ws.onerror = function () {
      ws.close();
    };
  }

  connect();
})();
