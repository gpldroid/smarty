import test from "node:test";
import assert from "node:assert/strict";
import { mergeSnapshots } from "../assets/js/cloud/snapshot.js";

test("first account sync merges legacy local favorites and playlists", () => {
  const merged = mergeSnapshots(
    { favorites: [{ url: "https://a.example/live", name: "Remote A" }], updatedAt: 0 },
    {
      favorites: [
        { url: "https://a.example/live", name: "Local A" },
        { url: "https://b.example/live", name: "Local B" }
      ],
      history: [{ url: "https://b.example/live", playedAt: 20 }],
      playlists: [{ id: "legacy-list", name: "Legacy", updatedAt: 10 }],
      theme: "light",
      updatedAt: 0
    }
  );
  assert.deepEqual(merged.favorites.map(item => item.url).sort(), [
    "https://a.example/live",
    "https://b.example/live"
  ]);
  assert.equal(merged.favorites.find(item => item.url === "https://a.example/live").name, "Local A");
  assert.equal(merged.playlists[0].id, "legacy-list");
  assert.equal(merged.theme, "light");
  assert.ok(merged.updatedAt > 0);
});

test("newer snapshot wins, including intentional deletions", () => {
  const merged = mergeSnapshots(
    { favorites: [{ url: "https://old.example/live" }], history: [], playlists: [], theme: "dark", updatedAt: 100 },
    { favorites: [], history: [], playlists: [], theme: "light", updatedAt: 200 }
  );
  assert.deepEqual(merged.favorites, []);
  assert.equal(merged.theme, "light");
  assert.ok(merged.updatedAt >= 200);
});

test("history is capped at 30 entries and sorted newest first", () => {
  const history = Array.from({ length: 35 }, (_, i) => ({
    url: "https://channel-" + i + ".example/live",
    playedAt: i + 1
  }));
  const merged = mergeSnapshots(
    { updatedAt: 1 },
    { history, updatedAt: 2 }
  );
  assert.equal(merged.history.length, 30);
  assert.equal(merged.history[0].playedAt, 35);
  assert.equal(merged.history.at(-1).playedAt, 6);
});
