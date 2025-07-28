/// <reference lib="webworker" />
type Msg =
  | { id: number; op: "writeText"; path: string[]; filename: string; text: string }
  | { id: number; op: "remove"; path: string[]; filename: string };
type Reply = { id: number; ok: true } | { id: number; ok: false; error: string };
const APP_DIR = "opfs-mixtape";

async function getAppDir(): Promise<FileSystemDirectoryHandle> {
  const root = await (navigator as any).storage.getDirectory();
  return root.getDirectoryHandle(APP_DIR, { create: true });
}
async function getDir(path: string[]): Promise<FileSystemDirectoryHandle> {
  let dir = await getAppDir();
  for (const part of path) dir = await dir.getDirectoryHandle(part, { create: true });
  return dir;
}

self.onmessage = (ev: MessageEvent<Msg>) => {
  (async () => {
    const msg = ev.data;
    try {
      if (msg.op === "writeText") {
        const dir = await getDir(msg.path);
        const fh = await dir.getFileHandle(msg.filename, { create: true });
        const ah: any = await (fh as any).createSyncAccessHandle();
        try {
          const data = new TextEncoder().encode(msg.text);
          await ah.truncate(0);
          await ah.write(data, { at: 0 });
          await ah.flush();
        } finally { await ah.close(); }
        (self as any).postMessage({ id: msg.id, ok: true } as Reply); return;
      }
      if (msg.op === "remove") {
        const dir = await getDir(msg.path);
        await dir.removeEntry(msg.filename);
        (self as any).postMessage({ id: msg.id, ok: true } as Reply); return;
      }
      (self as any).postMessage({ id: (msg as any).id, ok: false, error: "unknown op" } as Reply);
    } catch (e: any) {
      (self as any).postMessage({ id: (msg as any).id, ok: false, error: String(e?.message ?? e) } as Reply);
    }
  })();
};
