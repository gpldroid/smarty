function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stable(value[key])).join(",") + "}";
}

function identityOf(item, field) {
  return item && item[field] ? String(item[field]) : "";
}

function makeRecords(items, baseline, field, stamp, actor) {
  const current = new Map();
  (Array.isArray(items) ? items : []).forEach(item => {
    const key = identityOf(item, field);
    if (key) current.set(key, item);
  });

  const records = { ...(baseline || {}) };
  for (const [key, value] of current) {
    const previous = records[key];
    if (!previous || previous.deleted || stable(previous.value) !== stable(value)) {
      records[key] = { value, updatedAt: stamp, actor, deleted: false };
    }
  }
  for (const [key, previous] of Object.entries(records)) {
    if (!current.has(key) && !previous.deleted) {
      records[key] = { value: null, updatedAt: stamp, actor, deleted: true };
    }
  }
  return records;
}

function legacyRecords(items, field, stamp, actor) {
  const records = {};
  (Array.isArray(items) ? items : []).forEach(item => {
    const key = identityOf(item, field);
    if (key) records[key] = { value: item, updatedAt: stamp, actor, deleted: false };
  });
  return records;
}

function compareRevision(a, b) {
  const time = Number(a?.updatedAt || 0) - Number(b?.updatedAt || 0);
  if (time) return time;
  return String(a?.actor || "").localeCompare(String(b?.actor || ""));
}

function mergeRecordMaps(remote = {}, local = {}) {
  const merged = { ...remote };
  for (const [key, candidate] of Object.entries(local)) {
    if (!merged[key] || compareRevision(candidate, merged[key]) >= 0) merged[key] = candidate;
  }
  return merged;
}

function valuesFromRecords(records = {}, limit = Infinity, sortField = "") {
  return Object.values(records)
    .filter(record => record && !record.deleted && record.value)
    .sort((a, b) => {
      const aTime = Number(a.value?.[sortField] || a.updatedAt || 0);
      const bTime = Number(b.value?.[sortField] || b.updatedAt || 0);
      return bTime - aTime;
    })
    .slice(0, limit)
    .map(record => record.value);
}

export function mergeSnapshots(remote = {}, local = {}) {
  const now = Date.now();
  const localTime = Number(local.updatedAt || 0);
  const remoteTime = Number(remote.updatedAt || 0);
  const stamp = Math.max(now, localTime, remoteTime) + 1;
  const actor = String(local.deviceId || "local");
  const remoteRecords = remote._sync?.records || {};
  const localBaseline = local._sync?.records || {};

  const localFavorites = makeRecords(
    local.favorites, localBaseline.favorites || {},
    "url", stamp, actor
  );
  const localPlaylists = makeRecords(
    local.playlists, localBaseline.playlists || {},
    "id", stamp, actor
  );
  const localHistory = makeRecords(
    local.history, localBaseline.history || {},
    "url", stamp, actor
  );

  const mergedRecords = {
    favorites: mergeRecordMaps(
      remoteRecords.favorites || legacyRecords(remote.favorites, "url", remoteTime, "remote"),
      localFavorites
    ),
    playlists: mergeRecordMaps(
      remoteRecords.playlists || legacyRecords(remote.playlists, "id", remoteTime, "remote"),
      localPlaylists
    ),
    history: mergeRecordMaps(
      remoteRecords.history || legacyRecords(remote.history, "url", remoteTime, "remote"),
      localHistory
    )
  };

  const baselineTheme = local._sync?.theme;
  const localTheme = local.theme === "light" ? "light" : "dark";
  const localThemeRecord = !baselineTheme || baselineTheme.value !== localTheme
    ? { value: localTheme, updatedAt: stamp, actor }
    : baselineTheme;
  const remoteTheme = remote._sync?.theme || {
    value: remote.theme === "light" ? "light" : "dark",
    updatedAt: remoteTime,
    actor: "remote"
  };
  const themeRecord = compareRevision(localThemeRecord, remoteTheme) >= 0 ? localThemeRecord : remoteTheme;

  return {
    favorites: valuesFromRecords(mergedRecords.favorites),
    history: valuesFromRecords(mergedRecords.history, 30, "playedAt"),
    playlists: valuesFromRecords(mergedRecords.playlists),
    theme: themeRecord.value === "light" ? "light" : "dark",
    updatedAt: stamp,
    _sync: { records: mergedRecords, theme: themeRecord }
  };
}
