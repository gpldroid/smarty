import { isSafeMediaUrl } from "../m3u.js";

const API = "https://iptv-org.github.io/api";

export class IptvOrgClient {
  constructor(fetchImpl = globalThis.fetch) {
    if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required.");
    this.fetch = fetchImpl;
    this.searchCache = null;
  }

  async getCountries() {
    const response = await this.fetch(API + "/countries.json");
    if (!response.ok) throw new Error("Countries request failed");
    const countries = await response.json();
    return countries.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getCountryPlaylist(code) {
    const safeCode = String(code || "").trim().toLowerCase();
    if (!/^[a-z]{2,3}$/.test(safeCode)) throw new Error("Invalid country code");
    const response = await this.fetch("https://iptv-org.github.io/iptv/countries/" + encodeURIComponent(safeCode) + ".m3u");
    if (!response.ok) throw new Error("Country playlist unavailable");
    return response.text();
  }

  async searchChannels(query, limit = 200) {
    const q = String(query || "").trim().toLocaleLowerCase();
    if (!q) return [];
    if (!this.searchCache) {
      const [streamsResponse, channelsResponse] = await Promise.all([
        this.fetch("https://iptv-org.github.io/iptv/streams.json"),
        this.fetch(API + "/channels.json")
      ]);
      if (!streamsResponse.ok || !channelsResponse.ok) throw new Error("Global search unavailable");
      const [streams, channels] = await Promise.all([streamsResponse.json(), channelsResponse.json()]);
      const streamMap = new Map();
      streams.forEach(stream => {
        if (stream.channel && isSafeMediaUrl(stream.url) && !streamMap.has(stream.channel)) {
          streamMap.set(stream.channel, stream.url);
        }
      });
      this.searchCache = channels
        .filter(channel => channel.name && streamMap.has(channel.id))
        .map(channel => ({ id: channel.id, name: channel.name, logo: channel.logo, url: streamMap.get(channel.id) }));
    }
    return this.searchCache
      .filter(channel => channel.name.toLocaleLowerCase().includes(q))
      .slice(0, Math.max(1, Math.min(500, Number(limit) || 200)));
  }
}
