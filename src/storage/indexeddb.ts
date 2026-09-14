import { createSeedFramework } from '../domain/seed';
import type { FrameworkDocument, FrameworkRun } from '../domain/types';

const DB_NAME = 'visual-framework';
const DB_VERSION = 1;
const FRAMEWORKS = 'frameworks';
const RUNS = 'runs';
const META = 'meta';
const ACTIVE_ID = 'framework-main';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FRAMEWORKS)) db.createObjectStore(FRAMEWORKS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(RUNS)) {
        const store = db.createObjectStore(RUNS, { keyPath: 'id' });
        store.createIndex('frameworkId', 'frameworkId', { unique: false });
      }
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function migrateLegacy(db: IDBDatabase): Promise<FrameworkDocument | null> {
  const raw = localStorage.getItem('visual-framework-workflow-v1');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { nodes?: any[]; edges?: any[] };
    if (!parsed.nodes?.length || !Array.isArray(parsed.edges)) return null;
    const migrated: FrameworkDocument = {
      id: ACTIVE_ID,
      name: 'Framework',
      updatedAt: new Date().toISOString(),
      frames: parsed.nodes.map(node => ({ ...node })),
      connections: parsed.edges.map(edge => ({
        id: edge.id,
        fromFrame: edge.fromFrame ?? edge.fromNode,
        fromPort: edge.fromPort,
        toFrame: edge.toFrame ?? edge.toNode,
        toPort: edge.toPort
      }))
    };
    const tx = db.transaction(FRAMEWORKS, 'readwrite');
    tx.objectStore(FRAMEWORKS).put(migrated);
    localStorage.removeItem('visual-framework-workflow-v1');
    return migrated;
  } catch {
    return null;
  }
}

export async function loadFramework(): Promise<FrameworkDocument> {
  const db = await openDatabase();
  const tx = db.transaction(FRAMEWORKS, 'readonly');
  const saved = await requestValue(tx.objectStore(FRAMEWORKS).get(ACTIVE_ID)) as FrameworkDocument | undefined;
  if (saved) return saved;
  const migrated = await migrateLegacy(db);
  if (migrated) return migrated;
  const seed = createSeedFramework();
  await saveFramework(seed);
  return seed;
}

export async function saveFramework(framework: FrameworkDocument): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(FRAMEWORKS, 'readwrite');
  tx.objectStore(FRAMEWORKS).put({ ...framework, updatedAt: new Date().toISOString() });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveRun(run: FrameworkRun): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(RUNS, 'readwrite');
  tx.objectStore(RUNS).put(run);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
