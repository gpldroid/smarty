import test from "node:test";
import assert from "node:assert/strict";
import { cloudStorage } from "../assets/js/storage.js";

test("cloud sync reports local-only until a provider is configured", async () => {
  assert.equal(cloudStorage.enabled, false);
  assert.deepEqual(await cloudStorage.sync({ favorites: [] }), { status: "local-only" });
});

test("cloud adapter pulls, merges and pushes the full snapshot", async () => {
  let pushed = null;
  cloudStorage.configure({
    async pull() { return { favorites: ["remote"], profile: { theme: "dark" } }; },
    merge(remote, local) { return { ...remote, ...local, merged: true }; },
    async push(payload) { pushed = payload; }
  });
  assert.equal(cloudStorage.enabled, true);
  const result = await cloudStorage.sync({ favorites: ["local"], playlists: [] });
  assert.deepEqual(result, { status: "synced" });
  assert.deepEqual(pushed, {
    favorites: ["local"],
    profile: { theme: "dark" },
    playlists: [],
    merged: true
  });
});

test("cloud adapter configuration validates required methods", () => {
  assert.throws(() => cloudStorage.configure({ pull() {} }), /pull\(\) and push\(\)/);
});
