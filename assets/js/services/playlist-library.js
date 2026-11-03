function createId() {
  return globalThis.crypto?.randomUUID?.() || String(Date.now()) + "-" + Math.random().toString(36).slice(2);
}

export function createPlaylistRecord(name, channels, options = {}) {
  const safeName = String(name || "").trim();
  if (!safeName) throw new TypeError("Playlist name is required.");
  if (!Array.isArray(channels)) throw new TypeError("Playlist channels must be an array.");
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const id = options.id || createId();
  return { id, name: safeName, channels: [...channels], updatedAt: now };
}

export function upsertPlaylist(playlists = [], entry, limit = 10) {
  if (!entry || !entry.id || !entry.name) throw new TypeError("A valid playlist record is required.");
  const max = Math.max(1, Math.min(100, Number(limit) || 10));
  return [entry, ...playlists.filter(item => item && item.id !== entry.id && item.name !== entry.name)].slice(0, max);
}

export function removePlaylist(playlists = [], id) {
  if (!Array.isArray(playlists) || !id) return Array.isArray(playlists) ? [...playlists] : [];
  return playlists.filter(item => item && item.id !== id);
}
