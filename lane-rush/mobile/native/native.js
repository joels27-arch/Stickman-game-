/**
 * 4 FRIENDS — the iOS app's differences from the website.
 *
 * In the app the game's files are served by the app itself
 * (capacitor://localhost), but the lobbies still run on the website's server.
 * client.js builds three things from the page it runs on, so this file, loaded
 * before it (scripts/build-web.mjs adds it to index.html), points each one at
 * the right place:
 *
 *   socket   ws://localhost/ws/<CODE>      → the server's /ws/<CODE>
 *   invites  capacitor://localhost/?join=… → the website's /?join=…, shared
 *            through the iOS share sheet
 *   buzz     navigator.vibrate (iOS has none) → the Taptic Engine
 *
 * It calls the native plugins through the bridge Capacitor injects
 * (`Capacitor.nativePromise`), so the game needs no bundler. Outside the app
 * it does nothing.
 */
(function () {
  "use strict";

  // The one place the app's server lives: change both to move the app to
  // another deploy (and rebuild).
  var SITE = "https://lane-rush-party.higgsfield.app";
  var SERVER = "wss://lane-rush-party.higgsfield.app";

  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
  var here = location.origin;

  function call(plugin, method, options) {
    try {
      return cap.nativePromise(plugin, method, options);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // ── socket: a URL on this page's own host goes to the server instead ──────
  var PageSocket = window.WebSocket;
  function toServer(url) {
    var u = new URL(String(url), location.href);
    return u.host === location.host ? SERVER + u.pathname + u.search : url;
  }
  window.WebSocket = class extends PageSocket {
    constructor(url, protocols) {
      super(toServer(url), protocols);
    }
  };

  // ── invites: links to this page become links to the website ───────────────
  function toSite(value) {
    return typeof value === "string" ? value.split(here).join(SITE) : value;
  }

  // The share sheet. The client shows the raw link when a share fails, so a
  // cancelled sheet resolves quietly, and a broken plugin copies the link.
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: function (data) {
      data = data || {};
      var url = toSite(data.url);
      var text = toSite(data.text);
      // the link goes as its own item (Messages shows its preview), not twice
      if (url && text) text = text.split(url).join("").replace(/[\s→:-]+$/, "");
      return call("Share", "share", { title: data.title, text: text, url: url, dialogTitle: data.title }).then(
        function () {},
        function (err) {
          if (/cancel/i.test(String(err && err.message))) return;
          if (url && navigator.clipboard) return navigator.clipboard.writeText(url).catch(function () {});
        },
      );
    },
  });

  if (navigator.clipboard && navigator.clipboard.writeText) {
    var writeText = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = function (text) {
      return writeText(toSite(text));
    };
  }

  // ── buzz: the client's vibration patterns as Taptic Engine taps ───────────
  // A number is one buzz; an array is buzz, pause, buzz, … in milliseconds.
  function tap(ms) {
    var style = ms >= 50 ? "HEAVY" : ms >= 25 ? "MEDIUM" : "LIGHT";
    call("Haptics", "impact", { style: style }).catch(function () {});
  }
  Object.defineProperty(navigator, "vibrate", {
    configurable: true,
    value: function (pattern) {
      var steps = Array.isArray(pattern) ? pattern : [pattern];
      var at = 0;
      steps.forEach(function (ms, i) {
        ms = Number(ms) || 0;
        if (i % 2 === 0 && ms > 0) setTimeout(tap, at, ms);
        at += ms;
      });
      return true;
    },
  });
})();
