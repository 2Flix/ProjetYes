// Stockage des fichiers entre les pages (IndexedDB : pas de limite de 5 Mo comme sessionStorage)
const DB_NAME = "junia-viz";
const STORE = "files";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "name" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function runTx(mode, action) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
  }));
}

async function saveFiles(files) {
  const items = await Promise.all(
    files.map(async f => ({ name: f.name, size: f.size, content: await f.text() }))
  );
  await runTx("readwrite", s => { s.clear(); items.forEach(i => s.put(i)); });
}

function loadFiles() {
  return runTx("readonly", s => s.getAll());
}