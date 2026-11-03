import test from "node:test";
import assert from "node:assert/strict";
import { parseM3U, isSafeMediaUrl } from "../assets/js/m3u.js";

test("parses M3U metadata and CRLF line endings", () => {
  const source = '\uFEFF#EXTM3U\r\n#EXTINF:-1 tvg-id="news.one" tvg-logo="https://cdn.example/logo.png" group-title="News",News One\r\nhttps://stream.example/live.m3u8\r\n';
  const result = parseM3U(source);
  assert.equal(result.channels.length, 1);
  assert.equal(result.channels[0].name, "News One");
  assert.equal(result.channels[0].id, "news.one");
  assert.equal(result.channels[0].group, "News");
  assert.equal(result.rejected, 0);
});

test("rejects unsafe stream and logo schemes", () => {
  const source = '#EXTM3U\n#EXTINF:-1 tvg-logo="javascript:alert(1)",Bad Stream\njavascript:alert(1)\n';
  const result = parseM3U(source);
  assert.equal(result.channels.length, 0);
  assert.equal(result.rejected, 1);
  assert.equal(isSafeMediaUrl("javascript:alert(1)"), false);
  assert.equal(isSafeMediaUrl("data:text/html,hello"), false);
});

test("accepts HTTP and HTTPS media URLs only", () => {
  assert.equal(isSafeMediaUrl("https://example.com/live.m3u8"), true);
  assert.equal(isSafeMediaUrl("http://example.com/live.m3u8"), true);
  assert.equal(isSafeMediaUrl("file:///etc/passwd"), false);
  assert.equal(isSafeMediaUrl("not-a-url"), false);
});

test("reports empty and incomplete playlists", () => {
  assert.equal(parseM3U("  ").channels.length, 0);
  const result = parseM3U("#EXTM3U\n#EXTINF:-1,Channel without URL");
  assert.equal(result.channels.length, 0);
  assert.equal(result.rejected, 1);
  assert.equal(result.errors.length, 1);
});