export type JsonValue = unknown;
const APP_DIR = "opfs-mixtape";

let _worker: Worker | null = null;
let _rpcId = 0;
const _pending = new Map<number, (reply: { ok: boolean; error?: string }) => void>();

function _getWorker(): Worker {
  if (_worker) return _worker;
  _worker = new Worker(new URL("./opfs-worker.ts", import.meta.url), { type: "module" });
  _worker.onmessage = (ev: MessageEvent<{ id: number; ok: boolean; error?: string }>) => {
    const fn = _pending.get(ev.data.id);
    if (fn) { _pending.delete(ev.data.id); fn({ ok: ev.data.ok, error: ev.data.error }); }
  };
  return _worker;
}

function _callWorker(msg: Record<string, unknown>): Promise<void> {
  const id = ++_rpcId;
  const w = _getWorker();
  return new Promise((resolve, reject) => {
    _pending.set(id, r => r.ok ? resolve() : reject(new Error(r.error || "Worker error")));
    w.postMessage({ ...msg, id });
  });
}

async function getAppDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(APP_DIR, { create: true });
}

export async function getDir(path: string[]): Promise<FileSystemDirectoryHandle> {
  let dir = await getAppDir();
  for (const part of path) dir = await dir.getDirectoryHandle(part, { create: true });
  return dir;
}

export async function writeText(path: string[], filename: string, text: string): Promise<void> {
  const dir = await getDir(path);
  const fh = await dir.getFileHandle(filename, { create: true });
  if ("createWritable" in fh) {
    const w: any = await (fh as any).createWritable();
    await w.write(text); await w.close(); return;
  }
  await _callWorker({ op: "writeText", path, filename, text });
}

export async function readText(path: string[], filename: string): Promise<string | null> {
  try {
    const dir = await getDir(path);
    const fh = await dir.getFileHandle(filename, { create: false });
    const file = await fh.getFile();
    return await file.text();
  } catch { return null; }
}

export async function writeJson(path: string[], filename: string, value: JsonValue): Promise<void> {
  await writeText(path, filename, JSON.stringify(value, null, 2));
}

export async function readJson<T = any>(path: string[], filename: string): Promise<T | null> {
  const txt = await readText(path, filename);
  if (txt === null) return null;
  try { return JSON.parse(txt) as T; } catch { return null; }
}

export async function remove(path: string[], filename: string): Promise<void> {
  try {
    const dir = await getDir(path);
    await dir.removeEntry(filename);
  } catch {
    await _callWorker({ op: "remove", path, filename });
  }
}
