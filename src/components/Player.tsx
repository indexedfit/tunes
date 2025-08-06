import React, { useEffect, useRef, useState } from "react";
import type { TrackMeta } from "../types";
import { trackUrl } from "../utils/opfs";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

export function Player({
  queue,
  index,
  setIndex,
  onDuration,
}: {
  queue: TrackMeta[];
  index: number | null;
  setIndex: (i: number | null) => void;
  onDuration: (cid: string, dur: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);

  const track = index != null ? queue[index] : null;

  useEffect(() => {
    let alive = true; let created: string | null = null;
    setUrl(null); setPos(0); setDuration(0);
    if (!track) return;
    trackUrl(track.cid).then(u => { if (!alive) return; created = u; setUrl(u); });
    return () => { alive = false; if (created) URL.revokeObjectURL(created); };
  }, [track?.cid]);

  // MediaSession + keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "ArrowLeft") seekRel(-5);
      if (e.key === "ArrowRight") seekRel(+5);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [track, playing]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !track) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: track.name });
    navigator.mediaSession.setActionHandler("previoustrack", () => prev());
    navigator.mediaSession.setActionHandler("nexttrack", () => next());
    navigator.mediaSession.setActionHandler("play", () => { audioRef.current?.play(); setPlaying(true); });
    navigator.mediaSession.setActionHandler("pause", () => { audioRef.current?.pause(); setPlaying(false); });
  }, [track]);

  // progress loop
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const a = audioRef.current;
      if (a && a.duration) setPos(a.currentTime / a.duration);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };
  const next = () =>
    setIndex(queue.length ? (index! + 1) % queue.length : null);
  const prev = () =>
    setIndex(queue.length ? (index! - 1 + queue.length) % queue.length : null);
  const seekRel = (sec: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(
      0,
      Math.min((a.currentTime || 0) + sec, a.duration || 0),
    );
  };
  const seekTo = (p: number) => {
    const a = audioRef.current; if (!a) return;
    a.currentTime = p * (a.duration || 0);
  };

  return (
    <div className="player">
      <div className="player-left"><div className="player-cover ph">🎵</div>
        <div className="player-meta"><div className="player-title">{track?.name || "Nothing playing"}</div></div>
      </div>
      <div className="player-center">
        <div className="player-controls">
          <button className="icon-btn" onClick={prev}><SkipBack size={18} /></button>
          <button className="icon-btn primary" onClick={toggle}>{playing ? <Pause size={18}/> : <Play size={18}/>}</button>
          <button className="icon-btn" onClick={next}><SkipForward size={18} /></button>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={pos}
          onChange={(e) => seekTo(parseFloat(e.currentTarget.value))}
          style={{ width: "min(700px,90%)" }}
        />
      </div>
      <audio
        ref={audioRef}
        src={url || undefined}
        onCanPlay={(e) => {
          const a = e.currentTarget; const d = a.duration || 0;
          setDuration(d);
          if (track && isFinite(d)) onDuration(track.cid, d);
        }}
        onEnded={() => next()}
        autoPlay
        preload="metadata"
      />
    </div>
  );
}

