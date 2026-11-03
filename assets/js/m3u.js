const FALLBACK_LOGO = "https://cdn-icons-png.flaticon.com/512/716/716429.png";

export function isSafeMediaUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch { return false; }
}

function attribute(line, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = line.match(new RegExp("(?:^|\\s)" + escaped + '="([^"]*)"', "i"));
  return match ? match[1].trim() : "";
}

export function parseM3U(source) {
  if (typeof source !== "string" || !source.trim()) return { channels: [], rejected: 0, errors: ["The playlist is empty."] };
  const lines = source.replace(/^\\uFEFF/, "").split(/\\r?\\n/);
  const channels = [];
  const errors = [];
  let current = null;
  let rejected = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF:")) {
      const comma = line.indexOf(",");
      const name = comma >= 0 ? line.slice(comma + 1).trim() : attribute(line, "tvg-name");
      current = {
        id: "", name: name || attribute(line, "tvg-name") || "Unnamed channel",
        logo: attribute(line, "tvg-logo"), group: attribute(line, "group-title"),
        country: attribute(line, "tvg-country"), url: ""
      };
      continue;
    }
    if (line.startsWith("#")) continue;
    if (!current) { rejected++; continue; }
    if (!isSafeMediaUrl(line)) { rejected++; current = null; continue; }
    current.url = line;
    current.id = attribute(raw, "tvg-id") || line;
    current.logo = isSafeMediaUrl(current.logo) ? current.logo : FALLBACK_LOGO;
    channels.push(current);
    current = null;
  }
  if (current) { rejected++; errors.push("The final channel entry has no stream URL."); }
  return { channels, rejected, errors };
}

export { FALLBACK_LOGO };