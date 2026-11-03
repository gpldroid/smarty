const DB_NAME = "smarty-iptv";
const DB_VERSION = 1;
const STORE = "records";

function openDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("IndexedDB unavailable"));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbRequest(mode, action) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

const fallback = {
  get(key) { try { return JSON.parse(localStorage.getItem("smarty:" + key)); } catch { return null; } },
  set(key, value) { try { localStorage.setItem("smarty:" + key, JSON.stringify(value)); return true; } catch { return false; } }
};

export const storage = {
  async get(key, defaultValue = null) {
    try { const value = await idbRequest("readonly", store => store.get(key)); return value ?? defaultValue; }
    catch { return fallback.get(key) ?? defaultValue; }
  },
  async set(key, value) {
    try { await idbRequest("readwrite", store => store.put(value, key)); return true; }
    catch { return fallback.set(key, value); }
  },
  async remove(key) {
    try { await idbRequest("readwrite", store => store.delete(key)); }
    catch { try { localStorage.removeItem("smarty:" + key); } catch {} }
  }
};

// Cloud synchronization is deliberately opt-in. A provider adapter can be registered
// without coupling the local-first application to a specific backend or exposing secrets.
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
    await cloudAdapter.push({ ...remote, ...snapshot });
    return { status: "synced" };
  }
};