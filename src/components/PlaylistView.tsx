import { useMemo, useState } from "react";
import type { Helia } from "helia";
import type { Manifest } from "../lib/manifest";
import TrackRow from "./TrackRow";
import { usePlayer } from "../player/PlayerContext";

export default function PlaylistView({
  helia, manifest, playlistId, onRemoveTrack, onReorder
}: {
  helia: Helia;
  manifest: Manifest;
  playlistId?: string;
  onRemoveTrack: (trackId: string) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const playlist = playlistId ? manifest.playlists?.[playlistId] : undefined;
  const tracks = useMemo(() => {
    if (!playlist) return [];
    return playlist.trackIds.map(id => manifest.tracks[id]).filter(Boolean).filter(t => !t.deleted);
  }, [playlist, manifest]);
  const { playTracks } = usePlayer();

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, index: number) {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }
  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setOverIndex(index);
    e.dataTransfer.dropEffect = "move";
  }
  function handleDrop(e: React.DragEvent, index: number) {
    e.preventDefault();
    const from = dragIndex ?? Number(e.dataTransfer.getData("text/plain"));
    const to = index;
    setDragIndex(null); setOverIndex(null);
    if (Number.isFinite(from) && Number.isFinite(to) && from !== to) onReorder(from, to);
  }
  function handleDragEnd() {
    setDragIndex(null); setOverIndex(null);
  }

  if (!playlist) return <div className="p-4 text-slate-500">Select a playlist</div>;

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-medium">{playlist.name}</h2>
          <p className="text-sm text-slate-500">{tracks.length} tracks</p>
        </div>
        <button className="btn btn-primary" onClick={() => playTracks(tracks, 0)}>Play all</button>
      </div>
      <div className="space-y-1">
        {tracks.map((t, idx) => (
          <div key={t.id}
               draggable
               onDragStart={(e) => handleDragStart(e, idx)}
               onDragOver={(e) => handleDragOver(e, idx)}
               onDrop={(e) => handleDrop(e, idx)}
               onDragEnd={handleDragEnd}
               className={`rounded ${overIndex === idx ? "ring-2 ring-indigo-400" : ""}`}>
            <TrackRow helia={helia} track={t} index={idx} onMenu={() => {}} onDelete={() => onRemoveTrack(t.id)} />
          </div>
        ))}
      </div>
      {tracks.length === 0 && <div className="text-slate-500 py-12">Drop tracks in from the Library to add.</div>}
    </div>
  );
}
