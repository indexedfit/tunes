import { readJson, writeJson } from "./opfs";
const PATH = ["config"];
const FILENAME = "config.json";

export interface AppConfig {
  blockstoreName: string;
  relayAddrs: string[];
  pubsubNamespace: string;
}

const DEFAULT_CONFIG: AppConfig = {
  blockstoreName: "bs",
  relayAddrs: [
    "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
    "/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa"
  ],
  pubsubNamespace: "jukebox-sync"
};

export async function loadConfig(): Promise<AppConfig> {
  const cfg = await readJson<AppConfig>(PATH, FILENAME);
  if (!cfg) { await writeJson(PATH, FILENAME, DEFAULT_CONFIG); return DEFAULT_CONFIG; }
  return { ...DEFAULT_CONFIG, ...cfg };
}
export async function saveConfig(cfg: AppConfig): Promise<void> {
  await writeJson(PATH, FILENAME, cfg);
}
