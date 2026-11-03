import test from "node:test";
import assert from "node:assert/strict";
import { toggleFavoriteEntry, recordHistoryEntry } from "../assets/js/domain/library.js";

test("adds and removes favorites without mutating the original collection", () => {
  const original = [{ name: "One", url: "https://one.example/live" }];
  const channel = { name: "Two", url: "https://two.example/live", logo: "https://img.example/two.png" };
  const added = toggleFavoriteEntry(original, channel);
  assert.equal(added.added, true);
  assert.equal(added.favorites.length, 2);
  assert.equal(original.length, 1);
  const removed = toggleFavoriteEntry(added.favorites, channel);
  assert.equal(removed.added, false);
  assert.deepEqual(removed.favorites, original);
  assert.throws(() => toggleFavoriteEntry([], { name: "No URL" }), /channel URL is required/);
});

test("records a channel once at the top of history and enforces the limit", () => {
  const history = [
    { name: "Old", url: "https://old.example/live", playedAt: 1 },
    { name: "Repeat", url: "https://repeat.example/live", playedAt: 2 }
  ];
  const updated = recordHistoryEntry(
    history,
    { name: "Repeat HD", url: "https://repeat.example/live", logo: "logo" },
    99
  );
  assert.equal(updated.length, 2);
  assert.equal(updated[0].name, "Repeat HD");
  assert.equal(updated[0].playedAt, 99);
  assert.equal(updated[1].name, "Old");
  const capped = recordHistoryEntry(
    Array.from({ length: 35 }, (_, i) => ({ url: "https://ch" + i + ".example/live" })),
    { name: "Newest", url: "https://new.example/live" },
    100,
    30
  );
  assert.equal(capped.length, 30);
  assert.equal(capped[0].name, "Newest");
});
