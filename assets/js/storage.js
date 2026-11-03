const DB_NAME = "smarty-iptv";
const DB_VERSION = 1;
const STORE = "records";

function openDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("IndexedDB unavailable"));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error("Unable to open local database"));
    request.onblocked = () => reject(new Error("Local database upgrade is blocked by another tab"));
  });
}

async function idbRequest(mode, action) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let result;
    let settled = false;
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => {
      if (!settled) { settled = true; reject(request.error || new Error("Local database request failed")); }
    };
    tx.oncomplete = () => {
      db.close();
      if (!settled) { settled = true; resolve(result); }
    };
    tx.onabort = () => {
      db.close();
      if (!settled) { settled = true; reject(tx.error || new Error("Local database transaction aborted")); }
    };
    tx.onerror = () => {
      db.close();
      if (!settled) { settled = true; reject(tx.error || new Error("Local database transaction failed")); }
    };
  });
}

const fallback = {
  get(key) {
    try {
      const raw = localStorage.getItem("smarty:" + key);
      return raw === null ? null : JSON.parse(raw);
    } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem("smarty:" + key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
  remove(key) {
    try { localStorage.removeItem("smarty:" + key); return true; }
    catch { return false; }
  }
};

export const storage = {
  async get(key, defaultValue = null) {
    try {
      const value = await idbRequest("readonly", store => store.get(key));
      return value ?? defaultValue;
    } catch { return fallback.get(key) ?? defaultValue; }
  },
  async set(key, value) {
    try { await idbRequest("readwrite", store => store.put(value, key)); return true; }
    catch { return fallback.set(key, value); }
  },
  async remove(key) {
    try { await idbRequest("readwrite", store => store.delete(key)); return true; }
    catch { return fallback.remove(key); }
  }
};

// Cloud synchronization remains provider-neutral until the owner selects and configures
// an authenticated backend. No credentials or remote endpoints are embedded here.
let cloudAdapter = null;
export const cloudStorage = {
  configure(adapter) {
    if (!adapter || typeof adapter.pull !== "function" || typeof adapter.push !== "function") {
      throw new TypeError("Cloud adapter must implement pull() and push().");
    }
    cloudAdapter = adapter;
  },
  get enabled() { return Boolean(cloudAdapter); },
  async sync(snapshot) {
    if (!cloudAdapter) return { status: "local-only" };
    const remote = await cloudAdapter.pull();
    const payload = typeof cloudAdapter.merge === "function"
      ? await cloudAdapter.merge(remote || {}, snapshot || {})
      : { ...(remote || {}), ...(snapshot || {}) };
    await cloudAdapter.push(payload);
    return { status: "synced" };
  }
};
