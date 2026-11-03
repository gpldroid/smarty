import test from "node:test";
import assert from "node:assert/strict";
import { createPlaylistRecord, upsertPlaylist, removePlaylist } from "../assets/js/services/playlist-library.js";

test("creates a validated playlist record with deterministic test options", () => {
  const channels = [{ name: "News", url: "https://stream.example/live.m3u8" }];
  const record = createPlaylistRecord("  Favorites  ", channels, { id: "list-1", now: 123 });
  assert.deepEqual(record, { id: "list-1", name: "Favorites", channels, updatedAt: 123 });
  assert.notEqual(record.channels, channels);
  assert.throws(() => createPlaylistRecord(" ", channels), /Playlist name is required/);
  assert.throws(() => createPlaylistRecord("Bad", null), /channels must be an array/);
});

test("upserts by name and keeps newest playlists first within the limit", () => {
  const old = [
    { id: "one", name: "News", channels: [] },
    { id: "two", name: "Sports", channels: [] }
  ];
  const replacement = { id: "three", name: "News", channels: [{ name: "New News" }] };
  const result = upsertPlaylist(old, replacement, 10);
  assert.deepEqual(result.map(item => item.id), ["three", "two"]);
  const capped = upsertPlaylist(
    Array.from({ length: 12 }, (_, i) => ({ id: String(i), name: "List " + i })),
    { id: "new", name: "Newest" },
    10
  );
  assert.equal(capped.length, 10);
  assert.equal(capped[0].id, "new");
});

test("removes only the selected saved playlist", () => {
  const lists = [{ id: "one" }, { id: "two" }, { id: "three" }];
  assert.deepEqual(removePlaylist(lists, "two"), [{ id: "one" }, { id: "three" }]);
  assert.deepEqual(removePlaylist(lists, "missing"), lists);
});
