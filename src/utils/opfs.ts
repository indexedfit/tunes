import { write, file as otFile, dir } from "opfs-tools";

const TRACKS_DIR = "/tracks";
let bytesWritten = 0;
export function getBytesWritten() { return bytesWritten; }

async function ensureDirs() {
  await dir(TRACKS_DIR).create();
}

export async function saveTrack(cid: string, blob: Blob) {
  await ensureDirs();
  const path = `${TRACKS_DIR}/${cid}`;
  const f = otFile(path);
  if (await f.exists()) return false;
  await write(path, blob.stream(), { overwrite: false });
  bytesWritten += blob.size;
  return true;
}

export async function trackUrl(cid: string) {
  const f = otFile(`${TRACKS_DIR}/${cid}`);
  if (!(await f.exists())) return null;
  const of = await f.getOriginFile();
  return of ? URL.createObjectURL(of) : null;
}
