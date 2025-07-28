import { useState } from "react";
import type { Manifest } from "../lib/manifest";

export default function PlaylistSidebar({
  manifest, selectedId, onSelect, onCreate, onRename, onDelete
}: {
  manifest: Manifest;
  selectedId?: string;
  onSelect: (id?: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  const playlists = Object.values(manifest.playlists || {}).filter(p => !p.deleted)
    .sort((a,b) => (a.name || "").localeCompare(b.name || ""));

  return (
    <div className="bg-white border-r border-slate-200 h-full">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-semibold text-sm">Playlists</h3>
        <button className="btn btn-secondary text-xs" onClick={onCreate}>New</button>
      </div>
      <div className="p-2 space-y-1">
        {playlists.length === 0 && <div className="text-xs text-slate-500 px-2 py-3">No playlists yet</div>}
        {playlists.map(p => (
          <div key={p.id} className={`px-3 py-2 rounded cursor-pointer flex items-center justify-between hover:bg-slate-100 ${selectedId === p.id ? "bg-indigo-50" : ""}`}
            onClick={() => onSelect(p.id)}>
            {editing === p.id ? (
              <input className="text-sm border px-2 py-1 w-full" defaultValue={p.name}
                onKeyDown={(e) => { if (e.key === "Enter") { onRename(p.id, (e.target as HTMLInputElement).value); setEditing(null); } else if (e.key === "Escape") setEditing(null); }}
                onBlur={(e) => { onRename(p.id, (e.target as HTMLInputElement).value); setEditing(null); }} autoFocus />
            ) : (
              <>
                <span className="text-sm">{p.name}</span>
                <div className="flex gap-2 text-xs">
                  <button className="text-slate-500 hover:underline" onClick={(e) => { e.stopPropagation(); setEditing(p.id); }}>Rename</button>
                  <button className="text-red-600 hover:underline" onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}>Delete</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
