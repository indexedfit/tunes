import React, { useState } from "react";
import * as Y from "yjs";
import type { PlaylistMeta } from "../types";
import type { PlaylistDoc } from "../yjs/playlists";

export function PlaylistSelector({
  playlists,
  current,
  onSelect,
}: {
  playlists: PlaylistMeta[];
  current: PlaylistDoc;
  onSelect: (id: string) => void;
}) {
  const [name, setName] = useState("");

  const moveTracksTo = (cids: string[], targetId: string) => {
    current.doc.transact(() => {
      const map = current.doc.getMap("playlists");
      const dest = map.get(targetId);
      if (!dest) return;
      const destTracks = dest.get("tracks") as Y.Array<any>;
      const srcTracks = current.tracks.toArray();
      cids.forEach((cid) => {
        const t = srcTracks.find((x) => x.cid === cid);
        if (t && !destTracks.toArray().some((x: any) => x.cid === cid)) {
          destTracks.push([t]);
        }
      });
    });
  };

  const create = () => {
    if (!name.trim()) return;
    current.doc.transact(() => {
      const id = crypto.randomUUID();
      const map = current.doc.getMap("playlists");
      const rec = new Y.Map();
      rec.set("info", { id, name: name.trim() });
      rec.set("tracks", new Y.Array());
      rec.set("chat", new Y.Array());
      map.set(id, rec);
      onSelect(id);
    });
    setName("");
  };

  return (
    <div>
      <div className="sidebar-header">Playlists</div>
      {playlists.map((p) => (
        <div
          key={p.id}
          className={`album-item ${p.id === current.id ? "active" : ""}`}
          onClick={() => onSelect(p.id)}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add("drag-over");
          }}
          onDragLeave={(e) => e.currentTarget.classList.remove("drag-over")}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("drag-over");
            const cids = JSON.parse(
              e.dataTransfer?.getData("text/plain") || "[]",
            );
            if (cids.length) moveTracksTo(cids, p.id);
          }}
        >
          {p.name}
        </div>
      ))}
      <div className="flex gap-1 px-2 py-2 border-t">
        <input
          className="album-input"
          placeholder="New playlist..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <button className="album-add-btn" onClick={create}>
          +
        </button>
      </div>
    </div>
  );
}
