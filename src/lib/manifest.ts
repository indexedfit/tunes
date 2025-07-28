import { unixfs as createUnixfs } from "@helia/unixfs";
import type { Helia } from "helia";
import { readJson, writeJson } from "./opfs";
import { saveRoot, loadRoot } from "./identity";

const PATH = ["state"];
const FILE = "manifest.json";

export interface TrackEntry {
  id: string;
  cid: string;
  name: string;
  path?: string; // crate/folder
  size?: number;
  mime?: string;
  addedAt: string;
  updatedAt?: string;
  deleted?: boolean;

  // music metadata
  title?: string;
  artist?: string;
  album?: string;
  durationSec?: number;
  coverDataUrl?: string; // small embedded cover as data URL
}

export interface FolderEntry {
  id: string; // full path
  name: string; // leaf
  path?: string; // parent
  description?: string;
  createdAt: string;
  updatedAt?: string;
  deleted?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: string;
  updatedAt?: string;
  deleted?: boolean;
}

export interface Manifest {
  version: 2;
  tracks: Record<string, TrackEntry>;
  folders?: Record<string, FolderEntry>;
  playlists?: Record<string, Playlist>;
}

export async function createEmptyManifest(): Promise<Manifest> {
  const m: Manifest = { version: 2, tracks: {}, folders: {}, playlists: {} };
  await writeJson(PATH, FILE, m);
  await saveRoot(null);
  return m;
}

export async function loadManifest(): Promise<Manifest> {
  const data = await readJson<Manifest>(PATH, FILE);
  if (data && data.version === 2) return data;
  return await createEmptyManifest();
}

export function mergeManifests(base: Manifest, incoming: Manifest): Manifest {
  const merged: Manifest = {
    version: 2,
    tracks: { ...base.tracks },
    folders: { ...(base.folders || {}) },
    playlists: { ...(base.playlists || {}) }
  };

  for (const [id, inc] of Object.entries(incoming.tracks)) {
    const cur = merged.tracks[id];
    if (!cur) { merged.tracks[id] = inc; continue; }
    const curTs = Date.parse(cur.updatedAt ?? cur.addedAt);
    const incTs = Date.parse(inc.updatedAt ?? inc.addedAt);
    if (incTs > curTs) merged.tracks[id] = inc;
  }

  for (const [path, inc] of Object.entries(incoming.folders || {})) {
    const cur = merged.folders![path];
    if (!cur) { merged.folders![path] = inc; continue; }
    const curTs = Date.parse(cur.updatedAt ?? cur.createdAt);
    const incTs = Date.parse(inc.updatedAt ?? inc.createdAt);
    if (incTs > curTs) merged.folders![path] = inc;
  }

  for (const [pid, inc] of Object.entries(incoming.playlists || {})) {
    const cur = merged.playlists![pid];
    if (!cur) { merged.playlists![pid] = inc; continue; }
    const curTs = Date.parse(cur.updatedAt ?? cur.createdAt);
    const incTs = Date.parse(inc.updatedAt ?? inc.createdAt);
    if (incTs > curTs) merged.playlists![pid] = inc;
  }

  return merged;
}

export async function saveManifestToOpfs(manifest: Manifest): Promise<void> {
  await writeJson(PATH, FILE, manifest);
}

export async function persistManifestToIpfs(helia: Helia, manifest: Manifest): Promise<string> {
  const fs = createUnixfs(helia);
  const bytes = new TextEncoder().encode(JSON.stringify(manifest));
  const cid = await fs.addBytes(bytes);
  await saveRoot(cid.toString());
  return cid.toString();
}

export async function loadRootManifestFromIpfs(helia: Helia): Promise<Manifest | null> {
  const { manifestCid } = await loadRoot();
  if (!manifestCid) return null;
  try {
    const fs = createUnixfs(helia);
    let text = "";
    const dec = new TextDecoder();
    for await (const chunk of fs.cat(manifestCid as any)) {
      text += dec.decode(chunk, { stream: true });
    }
    const parsed = JSON.parse(text) as Manifest;
    if (parsed?.version === 2) {
      await saveManifestToOpfs(parsed);
      return parsed;
    }
  } catch {}
  return null;
}
