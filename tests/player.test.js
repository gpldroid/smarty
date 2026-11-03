import test from "node:test";
import assert from "node:assert/strict";
import { StreamPlayer } from "../assets/js/player.js";

class FakeVideo {
  constructor() {
    this.listeners = {};
    this.paused = false;
    this.src = "";
    this.playCalls = 0;
  }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  pause() { this.paused = true; }
  removeAttribute(name) { if (name === "src") this.src = ""; }
  load() {}
  canPlayType() { return ""; }
  play() { this.playCalls++; return Promise.resolve(); }
}

test("rejects unsafe media URLs before initializing a player", async () => {
  const video = new FakeVideo();
  const player = new StreamPlayer(video);
  await assert.rejects(player.play("javascript:alert(1)"), /رابط البث غير صالح/);
  assert.equal(player.currentUrl, "");
});

test("HLS playback attaches media and destroys the previous instance on stop", async () => {
  const video = new FakeVideo();
  const instances = [];
  class FakeHls {
    static Events = { ERROR: "error", MANIFEST_PARSED: "manifest" };
    static ErrorTypes = { NETWORK_ERROR: "network", MEDIA_ERROR: "media" };
    static isSupported() { return true; }
    constructor() { this.handlers = {}; this.destroyed = false; instances.push(this); }
    on(name, callback) { this.handlers[name] = callback; }
    loadSource(url) { this.url = url; }
    attachMedia(target) { this.target = target; }
    destroy() { this.destroyed = true; }
  }
  globalThis.window = { Hls: FakeHls };
  const statuses = [];
  const player = new StreamPlayer(video, message => statuses.push(message));
  try {
    await player.play("https://stream.example/live.m3u8");
    assert.equal(instances[0].url, "https://stream.example/live.m3u8");
    assert.equal(instances[0].target, video);
    instances[0].handlers.manifest();
    await Promise.resolve();
    assert.equal(video.playCalls, 1);
    assert.ok(statuses.includes("يعمل الآن"));
    player.stop();
    assert.equal(instances[0].destroyed, true);
    assert.equal(player.currentUrl, "");
  } finally {
    delete globalThis.window;
  }
});

test("uses native HLS when the HLS library is unavailable", async () => {
  const video = new FakeVideo();
  video.canPlayType = type => type === "application/vnd.apple.mpegurl" ? "probably" : "";
  globalThis.window = {};
  const statuses = [];
  const player = new StreamPlayer(video, message => statuses.push(message));
  try {
    await player.play("https://stream.example/native.m3u8");
    assert.equal(video.src, "https://stream.example/native.m3u8");
    assert.ok(statuses.includes("يعمل الآن"));
  } finally {
    delete globalThis.window;
  }
});
