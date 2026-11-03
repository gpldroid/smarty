import test from "node:test";
import assert from "node:assert/strict";
import { IptvOrgClient } from "../assets/js/services/iptv-org-client.js";

function response(data, ok = true) {
  return { ok, json: async () => data, text: async () => data };
}

test("loads and alphabetically sorts IPTV countries", async () => {
  const client = new IptvOrgClient(async url => {
    assert.equal(url, "https://iptv-org.github.io/api/countries.json");
    return response([{ name: "Morocco", code: "ma" }, { name: "Albania", code: "al" }]);
  });
  const countries = await client.getCountries();
  assert.deepEqual(countries.map(item => item.code), ["al", "ma"]);
});

test("validates country codes and fetches the country playlist", async () => {
  const calls = [];
  const client = new IptvOrgClient(async url => {
    calls.push(url);
    return response("#EXTM3U");
  });
  await assert.rejects(client.getCountryPlaylist("../bad"), /Invalid country code/);
  assert.equal(await client.getCountryPlaylist("MA"), "#EXTM3U");
  assert.deepEqual(calls, ["https://iptv-org.github.io/iptv/countries/ma.m3u"]);
});

test("global search joins safe stream URLs with channel metadata and caches datasets", async () => {
  const calls = [];
  const client = new IptvOrgClient(async url => {
    calls.push(url);
    if (url.endsWith("/streams.json")) return response([
      { channel: "news.ma", url: "https://streams.example/news.m3u8" },
      { channel: "bad.ma", url: "javascript:alert(1)" }
    ]);
    if (url.endsWith("/channels.json")) return response([
      { id: "news.ma", name: "Morocco News", logo: "https://img.example/news.png" },
      { id: "bad.ma", name: "Unsafe Channel" }
    ]);
    throw new Error("Unexpected request: " + url);
  });
  const first = await client.searchChannels("morocco");
  const second = await client.searchChannels("news");
  assert.equal(first.length, 1);
  assert.equal(first[0].url, "https://streams.example/news.m3u8");
  assert.equal(second.length, 1);
  assert.equal(calls.length, 2);
});

test("rejects failed catalogue responses and blank searches", async () => {
  const client = new IptvOrgClient(async () => response([], false));
  assert.deepEqual(await client.searchChannels("   "), []);
  await assert.rejects(client.getCountries(), /Countries request failed/);
  await assert.rejects(client.searchChannels("news"), /Global search unavailable/);
});
