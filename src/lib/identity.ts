import { readJson, writeJson } from "./opfs";
const ID_PATH = ["identity"];
const ALLOWED_FILE = "allowed-peers.json";
const ROOT_FILE = "root.json";

export async function loadAllowedPeers(): Promise<Set<string>> {
  const data = await readJson<{ peers: string[] }>(ID_PATH, ALLOWED_FILE);
  return new Set(data?.peers ?? []);
}
export async function saveAllowedPeers(peers: Set<string>): Promise<void> {
  await writeJson(ID_PATH, ALLOWED_FILE, { peers: [...peers] });
}

export interface RootState { manifestCid: string | null; }
export async function loadRoot(): Promise<RootState> {
  const data = await readJson<RootState>(ID_PATH, ROOT_FILE);
  return data ?? { manifestCid: null };
}
export async function saveRoot(manifestCid: string | null): Promise<void> {
  await writeJson(ID_PATH, ROOT_FILE, { manifestCid });
}
