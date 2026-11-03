export function toggleFavoriteEntry(favorites = [], channel) {
  if (!channel || !channel.url) throw new TypeError("A channel URL is required.");
  const exists = favorites.some(item => item && item.url === channel.url);
  const next = exists
    ? favorites.filter(item => item && item.url !== channel.url)
    : [{ name: channel.name || "Unnamed channel", url: channel.url, logo: channel.logo || "" }, ...favorites];
  return { favorites: next, added: !exists };
}

export function recordHistoryEntry(history = [], channel, playedAt = Date.now(), limit = 30) {
  if (!channel || !channel.url) throw new TypeError("A channel URL is required.");
  const max = Math.max(1, Math.min(100, Number(limit) || 30));
  return [{
    name: channel.name || "Unnamed channel",
    url: channel.url,
    logo: channel.logo || "",
    playedAt: Number.isFinite(playedAt) ? playedAt : Date.now()
  }, ...history.filter(item => item && item.url !== channel.url)].slice(0, max);
}
