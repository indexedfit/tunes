import type { Helia } from "helia";
import { loadConfig } from "./config";
import { loadRoot } from "./identity";

export async function startSync(helia: Helia, onRemoteRoot: (cid: string) => void): Promise<void> {
  const cfg = await loadConfig();
  const topic = `${cfg.pubsubNamespace}`;
  const ps = helia.libp2p.services.pubsub as any;
  await ps.subscribe(topic);
  const seen = new Set<string>();

  ps.addEventListener("message", (evt: any) => {
    try {
      const txt = new TextDecoder().decode(evt.detail.data);
      const msg = JSON.parse(txt) as { type: "root" | "request"; cid?: string; timestamp?: number };
      if (msg.type === "root" && msg.cid && !seen.has(msg.cid)) { seen.add(msg.cid); onRemoteRoot(msg.cid); }
      else if (msg.type === "request") setTimeout(announce, 100);
    } catch {}
  });

  helia.libp2p.addEventListener("peer:connect", async () => {
    try {
      const payload = new TextEncoder().encode(JSON.stringify({ type: "request", timestamp: Date.now() }));
      await ps.publish(topic, payload);
    } catch {}
  });

  async function announce() {
    const root = await loadRoot();
    if (!root.manifestCid) return;
    try {
      const payload = new TextEncoder().encode(JSON.stringify({ type: "root", cid: root.manifestCid, timestamp: Date.now() }));
      await ps.publish(topic, payload);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (!/NoPeersSubscribedToTopic/i.test(msg)) console.warn("pubsub publish failed", e);
    }
  }

  await announce();
  setTimeout(announce, 500);
  setTimeout(announce, 2000);
  setInterval(announce, 10000);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(announce, 100); });
  }
}
