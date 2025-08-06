import React, { useEffect, useState } from "react";
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
  const [tracks, setTracks] = useState<TrackMeta[]>(playlist.tracks.toArray());
  useEffect(() => {
    setTracks(playlist.tracks.toArray());
    const obs = () => setTracks(playlist.tracks.toArray());
    playlist.tracks.observe(obs);
    return () => playlist.tracks.unobserve(obs);
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
  return (
    <tr
      className={`album-list-row ${active ? "selected" : ""}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
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
