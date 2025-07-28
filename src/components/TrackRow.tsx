import type { TrackEntry } from "../lib/manifest";
import type { Helia } from "helia";
import { usePlayer } from "../player/PlayerContext";

export default function TrackRow({
  track, onMenu, onDelete
}: {
  helia: Helia;
  track: TrackEntry;
  index: number;
  onMenu: (trackId: string, pos: {x: number; y: number}) => void;
  onDelete?: (trackId: string) => void;
}) {
  const { playTracks } = usePlayer();
  const coverUrl = track.coverDataUrl || undefined;

  return (
    <div
      className="grid grid-cols-[auto,1fr,auto] items-center gap-3 px-3 py-2 hover:bg-slate-100 rounded group"
      onContextMenu={(e) => { e.preventDefault(); onMenu(track.id, { x: e.clientX, y: e.clientY }); }}
    >
      <button className="w-8 h-8 rounded bg-slate-900 text-white grid place-items-center" title="Play"
        onClick={() => playTracks([track], 0)}>▶</button>

      <div className="flex items-center gap-3 min-w-0">
        {coverUrl ? <img src={coverUrl} alt="" className="w-10 h-10 rounded object-cover" /> : <div className="w-10 h-10 rounded bg-slate-200 grid place-items-center">♪</div>}
        <div className="min-w-0">
          <div className="truncate font-medium">{track.title || track.name}</div>
          <div className="text-xs text-slate-500 truncate">{[track.artist, track.album].filter(Boolean).join(" • ")}</div>
        </div>
      </div>

      <div className="justify-self-end flex items-center gap-2 opacity-100">
        <button className="btn" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); onMenu(track.id, { x: r.left, y: r.bottom + 4 }); }}>⋯</button>
        {onDelete && <button className="text-red-600 hover:underline" onClick={() => onDelete(track.id)}>Delete</button>}
      </div>
    </div>
  );
}
