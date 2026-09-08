// IndexedDB holds large study records; the cache keeps existing synchronous readers usable.
export function createLocalPersistence({ openDatabase, storage, report = () => {} }) {
  const cache = new Map();
  let database;
  let queue = Promise.resolve();
  let errorMessage = '';
  const status = (message) => { errorMessage = message; report(message); };
  return {
    get error() { return errorMessage; },
    async initialize() {
      try {
        database = await openDatabase();
        for (const [key, value] of await database.readAll()) cache.set(key, value);
      } catch {
        database = null;
        status('大型本機儲存無法開啟，暫用原有存檔。請保留此頁並匯出備份。');
      }
    },
    getItem(key) {
      if (cache.has(key)) return cache.get(key);
      try { return storage().getItem(key); } catch { return null; }
    },
    write(entries) {
      // Capture values now; serialize writes so an older save cannot finish last.
      const snapshot = Object.entries(entries);
      for (const [key, value] of snapshot) cache.set(key, value);
      queue = queue.then(async () => {
        try {
          if (database) {
            await database.write(snapshot);
            // Only remove migrated keys AFTER the complete transaction commits.
            for (const [key] of snapshot) {
              try { storage().removeItem(key); } catch { /* Durable copy is already saved. */ }
            }
          } else {
            for (const [key, value] of snapshot) storage().setItem(key, value);
          }
          status('');
          return true;
        } catch {
          status('本機存檔失敗，目前的作答仍在此頁記憶體中。請先匯出備份或確認雲端同步成功，再關閉頁面。');
          return false;
        }
      });
      return queue;
    },
  };
}

export function openStudyDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('oncologyTracker.records.v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('slices');
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Database upgrade blocked'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve({
        readAll: () => new Promise((done, fail) => {
          const tx = db.transaction('slices', 'readonly');
          const store = tx.objectStore('slices');
          const keys = store.getAllKeys();
          const values = store.getAll();
          tx.oncomplete = () => done(keys.result.map((key, index) => [key, values.result[index]]));
          tx.onabort = () => fail(tx.error);
          tx.onerror = () => fail(tx.error);
        }),
        write: (entries) => new Promise((done, fail) => {
          const tx = db.transaction('slices', 'readwrite');
          tx.oncomplete = () => done();
          tx.onabort = () => fail(tx.error);
          tx.onerror = () => fail(tx.error);
          for (const [key, value] of entries) tx.objectStore('slices').put(value, key);
        }),
      });
    };
  });
}

export const localPersistence = createLocalPersistence({
  openDatabase: openStudyDatabase,
  storage: () => globalThis.localStorage,
  report: (message) => globalThis.dispatchEvent?.(new CustomEvent('study-storage-status', { detail: message })),
});
