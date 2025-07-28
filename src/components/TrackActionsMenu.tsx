import { useEffect, useRef } from "react";
import type { Manifest } from "../lib/manifest";

export default function TrackActionsMenu({
  manifest, x, y, onClose, onAddToPlaylist, onCreateAndAdd, onDelete
}: {
  manifest: Manifest;
  x: number;
  y: number;
  onClose: () => void;
  onAddToPlaylist: (playlistId: string) => void;
  onCreateAndAdd: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  const playlists = Object.values(manifest.playlists || {}).filter(p => !p.deleted)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div ref={ref} className="fixed z-50 bg-white border border-slate-200 rounded shadow-lg w-56"
         style={{ left: x, top: y }}>
      <div className="px-3 py-2 text-xs text-slate-500">Add to playlist</div>
      <div className="max-h-56 overflow-auto">
        {playlists.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">No playlists</div>}
        {playlists.map(pl => (
          <button key={pl.id} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100"
                  onClick={() => { onAddToPlaylist(pl.id); onClose(); }}>
            {pl.name}
          </button>
        ))}
      </div>
      <div className="border-t border-slate-200" />
      <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100"
              onClick={() => { onCreateAndAdd(); onClose(); }}>
        + New playlist & add
      </button>
      <div className="border-t border-slate-200" />
      <button className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 text-red-600"
              onClick={() => { onDelete(); onClose(); }}>
        Delete from library
      </button>
    </div>
  );
}
