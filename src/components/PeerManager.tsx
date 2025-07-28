import { useEffect, useState } from "react";
import { loadAllowedPeers, saveAllowedPeers } from "../lib/identity";
import type { Helia } from "helia";

export default function PeerManager({ helia }: { helia: Helia }) {
  const [peers, setPeers] = useState<string[]>([]);
  useEffect(() => { (async () => setPeers([...(await loadAllowedPeers()).values()]))(); }, []);
  async function removePeer(id: string) {
    const s = await loadAllowedPeers(); s.delete(id); await saveAllowedPeers(s);
    try {
      const conn = helia.libp2p.getConnections().find((c: any) => c.remotePeer.toString() === id);
      if (conn) await conn.close();
    } catch {}
    setPeers([...(await loadAllowedPeers()).values()]);
  }
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Allowed Peers</h3>
      {peers.length === 0 ? <p className="text-sm text-slate-500">None</p> : (
        <ul className="space-y-1">
          {peers.map(p => (
            <li key={p} className="flex items-center justify-between text-sm">
              <span className="font-mono truncate">{p}</span>
              <button onClick={() => removePeer(p)} className="text-red-600 hover:underline">Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
