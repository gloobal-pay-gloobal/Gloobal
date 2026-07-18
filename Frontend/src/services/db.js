// A minimal, dependency-free IndexedDB helper. Just enough to open one
// database with one object store and do get/getAll/put/delete — not a
// general-purpose ORM, just what the offline queue (and anything else
// that wants durable client-side storage) needs.

const DB_NAME = "gloobal-id";
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this environment"));
  }
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("offlineQueue")) {
        db.createObjectStore("offlineQueue", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("keyValue")) {
        db.createObjectStore("keyValue", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode) {
  return openDb().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

export async function idbPut(storeName, value) {
  const store = await tx(storeName, "readwrite");
  return new Promise((resolve, reject) => {
    const req = store.put(value);
    req.onsuccess = () => resolve(value);
    req.onerror = () => reject(req.error);
  });
}

export async function idbDelete(storeName, key) {
  const store = await tx(storeName, "readwrite");
  return new Promise((resolve, reject) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetAll(storeName) {
  const store = await tx(storeName, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet(storeName, key) {
  const store = await tx(storeName, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
