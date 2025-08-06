// src/components/TrackList.tsx
import React, { useEffect, useRef, useState } from "react";
import type { PlaylistDoc } from "../yjs/playlists";
import type { TrackMeta } from "../types";

export function TrackList({
  playlist,
  selected,
  onSelectionChange,
  onPlay,
}: {
  playlist: PlaylistDoc;
  selected: Set<string>;
  onSelectionChange: (s: Set<string>) => void;
  onPlay: (index: number) => void;
}) {
  const [tracks, setTracks] = useState<TrackMeta[]>(
    playlist.items
      .toArray()
      .map((cid) => playlist.registry.get(cid))
      .filter(Boolean) as TrackMeta[],
  );

  useEffect(() => {
    const updateTracks = () => {
      const newTracks = playlist.items
        .toArray()
        .map((cid) => playlist.registry.get(cid))
        .filter(Boolean) as TrackMeta[];
      setTracks(newTracks);
    };

    updateTracks();
    playlist.items.observe(updateTracks);
    playlist.registry.observe(updateTracks);

    return () => {
      playlist.items.unobserve(updateTracks);
      playlist.registry.unobserve(updateTracks);
    };
  }, [playlist.id]);

  return (
    <table className="album-list">
      <tbody>
        {tracks.map((t, i) => (
          <Row
            key={t.cid}
            track={t}
            active={selected.has(t.cid)}
            onClick={() => {
              if (selected.size === 0) onPlay(i);
              else {
                const s = new Set(selected);
                s.has(t.cid) ? s.delete(t.cid) : s.add(t.cid);
                onSelectionChange(s);
              }
            }}
            onDoubleClick={() => onPlay(i)}
          />
        ))}
      </tbody>
    </table>
  );
}

function Row({
  track,
  active,
  onClick,
  onDoubleClick,
}: {
  track: TrackMeta;
  active: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  const rowRef = useRef<HTMLTableRowElement>(null);

  const handleClick = () => {
    if (rowRef.current) {
      rowRef.current.classList.add("clicked-feedback");
      setTimeout(() => {
        rowRef.current?.classList.remove("clicked-feedback");
      }, 33);
    }
    onClick();
  };

  const handleDoubleClick = () => {
    if (rowRef.current) {
      rowRef.current.classList.add("clicked-feedback");
      setTimeout(() => {
        rowRef.current?.classList.remove("clicked-feedback");
      }, 33);
    }
    onDoubleClick();
  };

  return (
    <tr
      ref={rowRef}
      className={`album-list-row ${active ? "selected" : ""}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      draggable={active}
      onDragStart={(e) => {
        if (active)
          e.dataTransfer?.setData("text/plain", JSON.stringify([track.cid]));
      }}
    >
      <td className="album-list-thumb">
        <div className="album-list-thumb-ph">🎵</div>
      </td>
      <td className="album-list-name">
        <div style={{ fontWeight: 600 }}>{track.name}</div>
      </td>
      <td
        className="album-list-date"
        title={`${Math.round(track.duration || 0)}s`}
      >
        {fmtDur(track.duration)}
      </td>
    </tr>
  );
}
function fmtDur(s?: number) {
  if (!s || !isFinite(s)) return "–:–";
  const m = Math.floor(s / 60),
    sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
