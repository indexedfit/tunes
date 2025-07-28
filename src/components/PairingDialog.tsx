import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Html5QrcodeScanner } from "html5-qrcode";
import type { Helia } from "helia";
import { loadAllowedPeers, saveAllowedPeers, loadRoot, saveRoot } from "../lib/identity";

interface PairPayload { addr: string; root?: string | null; }
function createPairPayload(addr: string, root?: string | null): string {
  return JSON.stringify({ addr, root } satisfies PairPayload);
}

export default function PairingDialog({ open, onClose, helia }: { open: boolean; onClose: () => void; helia: Helia; }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanRef = useRef<HTMLDivElement>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!open) return;
    const addrs = helia.libp2p.getMultiaddrs();
    const addr = addrs[0]?.toString() ?? "";
    (async () => {
      const root = (await loadRoot()).manifestCid ?? null;
      await QRCode.toCanvas(canvasRef.current, createPairPayload(addr, root));
    })();
  }, [open, helia]);

  useEffect(() => {
    if (!open || !scanning || !scanRef.current) return;
    const el = scanRef.current;
    const scanner = new Html5QrcodeScanner(el.id, { fps: 10, qrbox: 250 }, false);
    scanner.render(async (text: string) => {
      try {
        const payload = JSON.parse(text) as PairPayload;
        const peers = await loadAllowedPeers();
        const id = payload.addr.split("/p2p/").pop() ?? "";
        peers.add(id);
        await saveAllowedPeers(peers);
        const localRoot = (await loadRoot()).manifestCid;
        if (!localRoot && payload.root) await saveRoot(payload.root);
        try { await helia.libp2p.dial(payload.addr as any); } catch {}
        alert("Paired!");
        scanner.clear(); setScanning(false); onClose();
      } catch (e) { console.error(e); }
    }, (_err: any) => {});
    return () => { try { scanner.clear(); } catch {} };
  }, [open, scanning, helia, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center p-4 z-50">
      <div className="bg-white p-6 rounded-xl w-full max-w-sm space-y-4 shadow-lg">
        <h2 className="text-xl font-bold">Pair Device</h2>
        <p className="text-sm text-slate-500">Scan this QR on the other device, or scan theirs.</p>
        <canvas ref={canvasRef} className="mx-auto" />
        <div id="qr-scan" ref={scanRef} className="w-full" />
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setScanning(s => !s)} className="btn btn-secondary w-full">{scanning ? "Stop Scan" : "Scan Other QR"}</button>
          <button onClick={onClose} className="btn btn-primary w-full">Close</button>
        </div>
      </div>
    </div>
  );
}
