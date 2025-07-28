import { usePlayer } from "../player/PlayerContext";
import Visualizer from "./Visualizer";

function fmt(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function NowPlayingBar() {
  const { current, playing, toggle, next, prev, position, duration, seek } = usePlayer();

  return (
    <div className="fixed bottom-0 left-0 right-0 player-glass text-white">
      <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center gap-4">
        <div className="w-10 h-10 rounded bg-white/10 grid place-items-center overflow-hidden">
          {current?.coverDataUrl ? <img src={current.coverDataUrl} alt="" className="w-full h-full object-cover"/> : <span>♪</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate">{current ? (current.title || current.name) : "Nothing playing"}</div>
              <div className="text-xs opacity-80 truncate">{current ? [current.artist, current.album].filter(Boolean).join(" • ") : "—"}</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn" onClick={prev}>⟨⟨</button>
              <button className="btn" onClick={toggle}>{playing ? "Pause" : "Play"}</button>
              <button className="btn" onClick={next}>⟩⟩</button>
            </div>
          </div>

          {/* Visualizer */}
          <div className="mt-2">
            <Visualizer height={28} />
          </div>

          <div className="mt-2 flex items-center gap-2 text-xs opacity-90">
            <span className="w-10 text-right">{fmt(position)}</span>
            <input type="range" min={0} max={duration || 0} value={position} onChange={(e) => seek(Number(e.currentTarget.value))} className="w-full" />
            <span className="w-10">{fmt(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
