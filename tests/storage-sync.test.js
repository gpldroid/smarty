import test from "node:test";
import assert from "node:assert/strict";
import { cloudStorage } from "../assets/js/storage.js";

test("cloud sync pulls and merges again after an optimistic concurrency conflict", async () => {
  let pulls = 0;
  let pushes = 0;
  const seenVersions = [];
  cloudStorage.configure({
    async pull() {
      pulls += 1;
      return { rowVersion: pulls === 1 ? "version-1" : "version-2", marker: pulls };
    },
    merge(remote, local) {
      return { marker: remote.marker, localValue: local.value };
    },
    async push(_payload, expectedVersion) {
      pushes += 1;
      seenVersions.push(expectedVersion);
      if (pushes === 1) {
        const conflict = new Error("Concurrent update");
        conflict.code = "SYNC_CONFLICT";
        throw conflict;
      }
    }
  });

  const result = await cloudStorage.sync({ value: "local" });
  assert.equal(result.status, "synced");
  assert.equal(result.attempts, 2);
  assert.equal(pulls, 2);
  assert.equal(pushes, 2);
  assert.deepEqual(seenVersions, ["version-1", "version-2"]);
});

test("cloud sync does not retry non-conflict failures", async () => {
  let pulls = 0;
  let pushes = 0;
  cloudStorage.configure({
    async pull() { pulls += 1; return { rowVersion: "version-1" }; },
    merge(remote) { return remote; },
    async push() {
      pushes += 1;
      throw new Error("Permission denied");
    }
  });

  await assert.rejects(() => cloudStorage.sync({}), /Permission denied/);
  assert.equal(pulls, 1);
  assert.equal(pushes, 1);
});
