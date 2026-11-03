import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const app = readFileSync(new URL("assets/js/app.js", root), "utf8");
const css = readFileSync(new URL("assets/css/app.css", root), "utf8");

test("Smarty V2 entry point contains every DOM contract required by app.js", () => {
  const requiredIds = [...new Set([...app.matchAll(/\$\("([^"]+)"\)/g)].map(match => match[1]))];
  const htmlIds = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]));
  const missing = requiredIds.filter(id => !htmlIds.has(id));
  assert.deepEqual(missing, [], `Missing application DOM elements: ${missing.join(", ")}`);
});

test("Smarty V2 entry point loads the modular application directly", () => {
  assert.match(html, /src=["']assets\/js\/app\.js["']/);
  assert.match(html, /href=["']assets\/css\/app\.css["']/);
  assert.doesNotMatch(html, /v1\.html/i);
});

test("Smarty Vision includes both themes, responsive layouts and reduced-motion support", () => {
  assert.match(css, /body\.light\s*\{/);
  assert.match(css, /@media\s*\(max-width:\s*820px\)/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("mobile search and navigation controls are wired without inline handlers", () => {
  for (const id of ["mobileSearchToggle", "mobileShowAll", "mobileShowFavorites", "mobileShowHistory", "mobileAccount"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
    assert.match(app, new RegExp('\\$\\("' + id + '"\\)'));
  }
  assert.doesNotMatch(html, /onclick=/i);
  assert.match(css, /\.topbar\.search-open \.global-search/);
});

test("legacy localStorage values are migrated into IndexedDB when available", () => {
  assert.match(readFileSync(new URL("assets/js/storage.js", root), "utf8"), /One-time compatibility migration/);
  assert.match(readFileSync(new URL("assets/js/storage.js", root), "utf8"), /store\.put\(legacyValue, key\)/);
});
