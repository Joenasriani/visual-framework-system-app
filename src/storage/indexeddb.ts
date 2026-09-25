import { createSeedFramework } from '../domain/seed';
import type { Frame, FrameRole, FrameworkDocument, FrameworkRun } from '../domain/types';

const DB_NAME = 'visual-framework';
const DB_VERSION = 2;
const FRAMEWORKS = 'frameworks';
const RUNS = 'runs';
const META = 'meta';
const DEFAULT_ID = 'framework-main';
const ACTIVE_KEY = 'active-framework-id';

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

const defaultRole = (frame: Frame): FrameRole => {
  if (frame.kind === 'instruction') return 'instruction';
  if (frame.kind === 'expression' || frame.kind === 'check') return 'evaluation';
  if (frame.kind === 'output') return 'result';
  return 'concept';
};

function normalizeFramework(input: FrameworkDocument): FrameworkDocument {
  const createdAt = input.updatedAt || new Date().toISOString();
  return {
    ...input,
    goal: input.goal ?? 'understand',
    version: input.version ?? 1,
    proposals: input.proposals ?? [],
    transformations: input.transformations ?? [],
    layers: input.layers ?? [],
    frames: (input.frames ?? []).map(frame => ({
      ...frame,
      role: frame.role ?? defaultRole(frame),
      epistemicState: frame.epistemicState ?? (frame.kind === 'instruction' || frame.kind === 'expression' || frame.kind === 'check' ? 'known' : 'unknown'),
      provenance: frame.provenance ?? { origin: 'imported', createdAt }
    })),
    connections: (input.connections ?? []).map(connection => ({
      ...connection,
      kind: connection.kind ?? 'execution',
      meaning: connection.meaning ?? 'feeds',
      provenance: connection.provenance ?? { origin: 'imported', createdAt }
    }))
  };
}

async function readActiveId(db: IDBDatabase): Promise<string> {
  const tx = db.transaction(META, 'readonly');
  const id = await requestValue(tx.objectStore(META).get(ACTIVE_KEY)) as string | undefined;
  return id || DEFAULT_ID;
}

export async function setActiveFrameworkId(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(META, 'readwrite');
  tx.objectStore(META).put(id, ACTIVE_KEY);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function migrateLegacy(db: IDBDatabase): Promise<FrameworkDocument | null> {
  const raw = localStorage.getItem('visual-framework-workflow-v1');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { nodes?: any[]; edges?: any[] };
    if (!parsed.nodes?.length || !Array.isArray(parsed.edges)) return null;
    const migrated = normalizeFramework({
      id: DEFAULT_ID,
      name: 'Framework',
      updatedAt: new Date().toISOString(),
      frames: parsed.nodes.map(node => ({ ...node })),
      connections: parsed.edges.map(edge => ({
        id: edge.id,
        fromFrame: edge.fromFrame ?? edge.fromNode,
        fromPort: edge.fromPort,
        toFrame: edge.toFrame ?? edge.toNode,
        toPort: edge.toPort,
        kind: 'execution',
        meaning: 'feeds'
      }))
    });
    const tx = db.transaction([FRAMEWORKS, META], 'readwrite');
    tx.objectStore(FRAMEWORKS).put(migrated);
    tx.objectStore(META).put(migrated.id, ACTIVE_KEY);
    localStorage.removeItem('visual-framework-workflow-v1');
    return migrated;
  } catch {
    return null;
  }
}

export async function loadFramework(id?: string): Promise<FrameworkDocument> {
  const db = await openDatabase();
  const activeId = id ?? await readActiveId(db);
  const tx = db.transaction(FRAMEWORKS, 'readonly');
  const saved = await requestValue(tx.objectStore(FRAMEWORKS).get(activeId)) as FrameworkDocument | undefined;
  if (saved) return normalizeFramework(saved);
  const migrated = await migrateLegacy(db);
  if (migrated) return migrated;
  const seed = createSeedFramework();
  await saveFramework(seed);
  await setActiveFrameworkId(seed.id);
  return seed;
}

export async function saveFramework(framework: FrameworkDocument): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(FRAMEWORKS, 'readwrite');
  tx.objectStore(FRAMEWORKS).put(normalizeFramework({ ...framework, updatedAt: new Date().toISOString() }));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listFrameworks(): Promise<FrameworkDocument[]> {
  const db = await openDatabase();
  const tx = db.transaction(FRAMEWORKS, 'readonly');
  const items = await requestValue(tx.objectStore(FRAMEWORKS).getAll()) as FrameworkDocument[];
  return items.map(normalizeFramework).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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

export async function listRuns(frameworkId: string): Promise<FrameworkRun[]> {
  const db = await openDatabase();
  const tx = db.transaction(RUNS, 'readonly');
  const index = tx.objectStore(RUNS).index('frameworkId');
  const items = await requestValue(index.getAll(frameworkId)) as FrameworkRun[];
  return items.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
