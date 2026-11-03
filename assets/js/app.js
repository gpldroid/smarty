import { storage, cloudStorage } from "./storage.js";
import { parseM3U, FALLBACK_LOGO, isSafeMediaUrl } from "./m3u.js";
import { StreamPlayer } from "./player.js";

const API = "https://iptv-org.github.io/api";
const $ = (id) => document.getElementById(id);
const state = { countries: [], channels: [], filtered: [], visible: 0, batch: 48, favorites: [], history: [], searchCache: null, activeView: "all", playlistName: "" };
const player = new StreamPlayer($("videoPlayer"), (message) => { $("playerStatus").textContent = message; });

function toast(message) { const el = $("toast"); el.textContent = message; el.classList.remove("hidden"); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.add("hidden"), 3500); }
function setStatus(message) { $("channelStatus").textContent = message; }
function safeText(value, fallback = "") { return typeof value === "string" ? value : fallback; }

function renderCountries(list) {
  const root = $("countryList"); root.replaceChildren();
  const fragment = document.createDocumentFragment();
  list.forEach(country => {
    const button = document.createElement("button"); button.className = "country"; button.type = "button";
    const flag = document.createElement("span"); flag.textContent = "🌐";
    const name = document.createElement("span"); name.textContent = safeText(country.name, country.code);
    button.append(flag, name);
    button.addEventListener("click", () => loadCountry(country.code, country.name));
    fragment.append(button);
  });
  root.append(fragment);
}

async function loadCountries() {
  setStatus("جارٍ تحميل قائمة الدول…");
  try {
    const response = await fetch(API + "/countries.json");
    if (!response.ok) throw new Error("Countries request failed");
    state.countries = await response.json();
    state.countries.sort((a,b) => a.name.localeCompare(b.name));
    renderCountries(state.countries);
    setStatus("اختر دولة أو استورد قائمة M3U للبدء.");
  } catch { setStatus("تعذر تحميل الدول حالياً. يمكنك استيراد ملف M3U."); }
}

async function loadCountry(code, name) {
  setStatus("جارٍ تحميل قنوات " + name + "…");
  $("channelsGrid").replaceChildren();
  try {
    const response = await fetch("https://iptv-org.github.io/iptv/countries/" + encodeURIComponent(code.toLowerCase()) + ".m3u");
    if (!response.ok) throw new Error("Country playlist unavailable");
    const result = parseM3U(await response.text());
    state.playlistName = name;
    setChannels(result.channels, result.rejected);
  } catch { setStatus("تعذر تحميل قنوات هذه الدولة. جرّب لاحقاً أو استورد قائمة أخرى."); }
}

async function importText(text, name) {
  const result = parseM3U(text);
  if (!result.channels.length) { toast("لم يتم العثور على قنوات صالحة في القائمة."); return; }
  state.playlistName = name;
  setChannels(result.channels, result.rejected);
  const saved = await storage.get("playlists", []);
  const entry = { id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), name, channels: result.channels, updatedAt: Date.now() };
  await storage.set("playlists", [entry, ...saved.filter(item => item.name !== name)].slice(0, 10));
  toast("تم استيراد " + result.channels.length + " قناة.");
}

function setChannels(channels, rejected = 0) {
  state.channels = channels.map((channel, index) => ({ ...channel, id: channel.id || channel.url || String(index), name: safeText(channel.name, "Unnamed channel"), logo: isSafeMediaUrl(channel.logo) ? channel.logo : FALLBACK_LOGO }));
  state.activeView = "all";
  state.filtered = state.channels;
  state.visible = 0;
  $("viewTitle").textContent = state.playlistName || "القنوات";
  $("channelCount").textContent = state.channels.length + " قناة";
  renderNextBatch(true);
  setStatus(state.channels.length + " قناة جاهزة" + (rejected ? " · تم تجاهل " + rejected + " إدخال غير صالح" : ""));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function makeChannelCard(channel) {
  const col = document.createElement("div"); col.style.position = "relative";
  const card = document.createElement("button"); card.type = "button"; card.className = "channel-card"; card.setAttribute("aria-label", "تشغيل " + channel.name);
  const img = document.createElement("img"); img.className = "channel-logo"; img.loading = "lazy"; img.alt = ""; img.src = channel.logo || FALLBACK_LOGO;
  img.addEventListener("error", () => { img.src = FALLBACK_LOGO; }, { once: true });
  const name = document.createElement("span"); name.className = "channel-name"; name.textContent = channel.name;
  card.append(img, name);
  card.addEventListener("click", () => playChannel(channel));
  const fav = document.createElement("button"); fav.type = "button"; fav.className = "fav"; fav.textContent = "★"; fav.setAttribute("aria-label", "إضافة إلى المفضلة");
  const isFav = state.favorites.some(item => item.url === channel.url); fav.setAttribute("aria-pressed", String(isFav));
  fav.addEventListener("click", event => { event.stopPropagation(); toggleFavorite(channel, fav); });
  col.append(card, fav); return col;
}

function renderNextBatch(reset = false) {
  const grid = $("channelsGrid");
  if (reset) grid.replaceChildren();
  if (!state.filtered.length) { const empty = document.createElement("div"); empty.className = "empty"; empty.textContent = "لا توجد قنوات لعرضها. اختر دولة أو استورد قائمة M3U."; grid.replaceChildren(empty); $("loadMore").classList.add("hidden"); return; }
  const end = Math.min(state.visible + state.batch, state.filtered.length);
  const fragment = document.createDocumentFragment();
  for (let i = state.visible; i < end; i++) fragment.append(makeChannelCard(state.filtered[i]));
  grid.append(fragment); state.visible = end;
  $("loadMore").classList.toggle("hidden", state.visible >= state.filtered.length);
}

async function playChannel(channel) {
  $("currentTitle").textContent = channel.name;
  $("playerPlaceholder").classList.add("hidden");
  $("videoPlayer").classList.remove("hidden");
  try { await player.play(channel.url); }
  catch (error) { $("playerStatus").textContent = error.message; }
  state.history = [{ name: channel.name, url: channel.url, logo: channel.logo, playedAt: Date.now() }, ...state.history.filter(item => item.url !== channel.url)].slice(0, 30);
  await storage.set("history", state.history);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function toggleFavorite(channel, button) {
  const exists = state.favorites.some(item => item.url === channel.url);
  state.favorites = exists ? state.favorites.filter(item => item.url !== channel.url) : [{ name: channel.name, url: channel.url, logo: channel.logo }, ...state.favorites];
  await storage.set("favorites", state.favorites);
  button?.setAttribute("aria-pressed", String(!exists));
  toast(exists ? "تمت الإزالة من المفضلة." : "تمت الإضافة إلى المفضلة.");
  if (state.activeView === "favorites") showFavorites();
}

function applySearch(query) {
  const q = query.trim().toLocaleLowerCase();
  const source = state.activeView === "favorites" ? state.favorites : state.activeView === "history" ? state.history : state.channels;
  state.filtered = q ? source.filter(channel => channel.name.toLocaleLowerCase().includes(q) || (channel.group || "").toLocaleLowerCase().includes(q)) : source;
  state.visible = 0;
  $("viewTitle").textContent = q ? "نتائج البحث" : state.activeView === "favorites" ? "المفضلة" : state.activeView === "history" ? "آخر المشاهدات" : (state.playlistName || "القنوات");
  renderNextBatch(true); $("channelCount").textContent = state.filtered.length + " نتيجة";
}

async function searchGlobal(query) {
  const q = query.trim().toLocaleLowerCase(); if (!q) return;
  setStatus("جارٍ البحث في القنوات العالمية…"); $("channelsGrid").replaceChildren();
  try {
    if (!state.searchCache) {
      const [streamsResponse, channelsResponse] = await Promise.all([fetch("https://iptv-org.github.io/iptv/streams.json"), fetch(API + "/channels.json")]);
      if (!streamsResponse.ok || !channelsResponse.ok) throw new Error("Global search unavailable");
      const [streams, channels] = await Promise.all([streamsResponse.json(), channelsResponse.json()]);
      const streamMap = new Map();
      streams.forEach(stream => { if (stream.channel && isSafeMediaUrl(stream.url) && !streamMap.has(stream.channel)) streamMap.set(stream.channel, stream.url); });
      state.searchCache = channels.filter(channel => channel.name && streamMap.has(channel.id)).map(channel => ({ id: channel.id, name: channel.name, logo: channel.logo, url: streamMap.get(channel.id) }));
    }
    const results = state.searchCache.filter(channel => channel.name.toLocaleLowerCase().includes(q)).slice(0, 200);
    state.playlistName = "البحث العالمي"; setChannels(results);
    setStatus(results.length ? "تم العثور على " + results.length + " نتيجة." : "لم يتم العثور على قنوات مطابقة.");
  } catch { setStatus("تعذر إكمال البحث العالمي. تحقق من الاتصال وحاول مجدداً."); }
}

function showFavorites() { state.activeView = "favorites"; state.filtered = state.favorites; state.visible = 0; $("viewTitle").textContent = "المفضلة"; $("channelCount").textContent = state.filtered.length + " قناة"; renderNextBatch(true); }
function showHistory() { state.activeView = "history"; state.filtered = state.history; state.visible = 0; $("viewTitle").textContent = "آخر المشاهدات"; $("channelCount").textContent = state.filtered.length + " قناة"; renderNextBatch(true); }

async function init() {
  state.favorites = await storage.get("favorites", []); state.history = await storage.get("history", []);
  const theme = await storage.get("theme", "dark"); if (theme === "light") document.body.classList.add("light");
  $("themeToggle").addEventListener("click", async () => { document.body.classList.toggle("light"); await storage.set("theme", document.body.classList.contains("light") ? "light" : "dark"); });
  $("fileInput").addEventListener("change", async event => { const file = event.target.files?.[0]; if (file) await importText(await file.text(), file.name); event.target.value = ""; });
  $("urlImport").addEventListener("click", async () => { const url = prompt("أدخل رابط قائمة M3U:"); if (!url) return; if (!isSafeMediaUrl(url)) { toast("يُسمح فقط بروابط HTTP أو HTTPS."); return; } try { const response = await fetch(url); if (!response.ok) throw new Error(); await importText(await response.text(), new URL(url).hostname); } catch { toast("تعذر تحميل الرابط. قد لا يسمح المصدر بطلبات CORS."); } });
  $("globalSearch").addEventListener("keydown", event => { if (event.key === "Enter") searchGlobal(event.currentTarget.value); });
  $("localSearch").addEventListener("input", event => applySearch(event.currentTarget.value));
  $("countrySearch").addEventListener("input", event => { const q = event.currentTarget.value.toLocaleLowerCase(); renderCountries(state.countries.filter(item => item.name.toLocaleLowerCase().includes(q))); });
  $("loadMore").addEventListener("click", () => renderNextBatch());
  $("showAll").addEventListener("click", () => { state.activeView = "all"; state.filtered = state.channels; state.visible = 0; $("viewTitle").textContent = state.playlistName || "القنوات"; renderNextBatch(true); });
  $("showFavorites").addEventListener("click", showFavorites); $("showHistory").addEventListener("click", showHistory);
  $("openVlc").addEventListener("click", () => player.openExternal());
  $("stopPlayer").addEventListener("click", () => { player.stop(); $("playerPlaceholder").classList.remove("hidden"); $("videoPlayer").classList.add("hidden"); $("currentTitle").textContent = "لم يتم اختيار قناة"; $("playerStatus").textContent = "تم إيقاف التشغيل."; });
  $("syncButton").addEventListener("click", async () => { const result = await cloudStorage.sync({ favorites: state.favorites, history: state.history }); toast(result.status === "synced" ? "اكتملت المزامنة." : "التطبيق يعمل محلياً. لم يتم إعداد مزود التخزين السحابي بعد."); });
  await loadCountries();
}

document.addEventListener("DOMContentLoaded", init);