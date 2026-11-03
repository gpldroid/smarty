function mergeByIdentity(primary = [], secondary = [], identity = "url") {
  const items = new Map();
  [...primary, ...secondary].forEach(item => {
    if (!item || !item[identity]) return;
    const previous = items.get(item[identity]);
    if (!previous || Number(item.playedAt || item.updatedAt || 0) >= Number(previous.playedAt || previous.updatedAt || 0)) {
      items.set(item[identity], item);
    }
  });
  return [...items.values()].sort((a, b) => Number(b.playedAt || b.updatedAt || 0) - Number(a.playedAt || a.updatedAt || 0));
}

export function mergeSnapshots(remote = {}, local = {}) {
  const remoteTime = Number(remote.updatedAt || 0);
  const localTime = Number(local.updatedAt || 0);
  const hasLegacyLocalData = localTime === 0 &&
    [local.favorites, local.history, local.playlists].some(items => Array.isArray(items) && items.length);
  if (hasLegacyLocalData) {
    // Preserve data saved by older local-only versions on the first account sync.
    return {
      favorites: mergeByIdentity(remote.favorites, local.favorites, "url"),
      history: mergeByIdentity(remote.history, local.history, "url").slice(0, 30),
      playlists: mergeByIdentity(remote.playlists, local.playlists, "id"),
      theme: local.theme === "light" ? "light" : (remote.theme || "dark"),
      updatedAt: Date.now()
    };
  }
  // Last-write-wins for subsequent syncs prevents deleted items from reappearing.
  const winner = localTime >= remoteTime ? local : remote;
  return {
    favorites: Array.isArray(winner.favorites) ? winner.favorites : [],
    history: Array.isArray(winner.history) ? mergeByIdentity([], winner.history, "url").slice(0, 30) : [],
    playlists: Array.isArray(winner.playlists) ? winner.playlists : [],
    theme: winner.theme === "light" ? "light" : "dark",
    updatedAt: Math.max(remoteTime, localTime, Date.now())
  };
}
