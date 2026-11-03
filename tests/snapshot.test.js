import test from "node:test";
import assert from "node:assert/strict";
import { mergeSnapshots } from "../assets/js/cloud/snapshot.js";

test("first account sync merges legacy local and remote records", () => {
  const merged = mergeSnapshots(
    { favorites: [{ url: "https://a.example/live", name: "Remote A" }], updatedAt: 10 },
    {
      favorites: [
        { url: "https://a.example/live", name: "Local A" },
        { url: "https://b.example/live", name: "Local B" }
      ],
      history: [{ url: "https://b.example/live", playedAt: 20 }],
      playlists: [{ id: "legacy-list", name: "Legacy", updatedAt: 10 }],
      theme: "light",
      updatedAt: 0,
      deviceId: "device-a"
    }
  );
  assert.deepEqual(merged.favorites.map(item => item.url).sort(), [
    "https://a.example/live", "https://b.example/live"
  ]);
  assert.equal(merged.favorites.find(item => item.url === "https://a.example/live").name, "Local A");
  assert.equal(merged.playlists[0].id, "legacy-list");
  assert.equal(merged.theme, "light");
  assert.ok(merged._sync.records.favorites);
});

test("concurrent additions to separate devices are both retained", () => {
  const baseline = mergeSnapshots({}, {
    favorites: [{ url: "https://base.example/live", name: "Base" }],
    playlists: [], history: [], theme: "dark", updatedAt: 100, deviceId: "device-a"
  });
  const deviceA = mergeSnapshots({}, {
    favorites: [...baseline.favorites, { url: "https://a.example/live", name: "A" }],
    playlists: [], history: [], theme: "dark", updatedAt: 110,
    deviceId: "device-a", _sync: baseline._sync
  });
  const deviceB = mergeSnapshots({}, {
    favorites: [...baseline.favorites, { url: "https://b.example/live", name: "B" }],
    playlists: [], history: [], theme: "dark", updatedAt: 111,
    deviceId: "device-b", _sync: baseline._sync
  });
  const merged = mergeSnapshots(deviceA, {
    favorites: deviceB.favorites, playlists: [], history: [], theme: "dark",
    updatedAt: 111, deviceId: "device-b", _sync: deviceB._sync
  });
  assert.deepEqual(merged.favorites.map(item => item.url).sort(), [
    "https://a.example/live", "https://b.example/live", "https://base.example/live"
  ]);
});

test("deletions are represented as tombstones and do not resurrect", () => {
  const initial = mergeSnapshots({}, {
    favorites: [{ url: "https://remove.example/live", name: "Remove me" }],
    playlists: [], history: [], theme: "dark", updatedAt: 100, deviceId: "device-a"
  });
  const deleted = mergeSnapshots(initial, {
    favorites: [], playlists: [], history: [], theme: "dark",
    updatedAt: 120, deviceId: "device-a", _sync: initial._sync
  });
  assert.deepEqual(deleted.favorites, []);
  assert.equal(deleted._sync.records.favorites["https://remove.example/live"].deleted, true);
  const mergedAgain = mergeSnapshots(deleted, {
    favorites: initial.favorites, playlists: [], history: [], theme: "dark",
    updatedAt: 100, deviceId: "device-b", _sync: initial._sync
  });
  assert.deepEqual(mergedAgain.favorites, []);
});

test("history is capped at 30 entries and sorted newest first", () => {
  const history = Array.from({ length: 35 }, (_, i) => ({
    url: "https://channel-" + i + ".example/live", playedAt: i + 1
  }));
  const merged = mergeSnapshots({}, {
    history, favorites: [], playlists: [], theme: "dark", updatedAt: 2, deviceId: "device-a"
  });
  assert.equal(merged.history.length, 30);
  assert.equal(merged.history[0].playedAt, 35);
  assert.equal(merged.history.at(-1).playedAt, 6);
});

test("theme changes are merged independently from playlist and favorite records", () => {
  const base = mergeSnapshots({}, {
    favorites: [], playlists: [], history: [], theme: "dark", updatedAt: 100, deviceId: "device-a"
  });
  const changed = mergeSnapshots({}, {
    favorites: [], playlists: [], history: [], theme: "light",
    updatedAt: 120, deviceId: "device-a", _sync: base._sync
  });
  const merged = mergeSnapshots(changed, {
    favorites: [], playlists: [], history: [], theme: "dark",
    updatedAt: 100, deviceId: "device-b", _sync: base._sync
  });
  assert.equal(merged.theme, "light");
});
