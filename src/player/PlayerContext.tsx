import { createContext, useContext, useMemo, useRef, useState, useEffect } from "react";
import type { Helia } from "helia";
import type { TrackEntry } from "../lib/manifest";
import { unixfs } from "@helia/unixfs";

type Ctx = {
  queue: TrackEntry[];
  index: number;
  playing: boolean;
  current?: TrackEntry;
  playTracks: (tracks: TrackEntry[], startIndex?: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  position: number;
  duration: number;
  // Visualizer
  analyser?: AnalyserNode;
  audioContext?: AudioContext;
};
const PlayerCtx = createContext<Ctx | null>(null);

function useObjectUrl(helia: Helia, cid?: string) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    let revoked = false;
    const ac = new AbortController();
    (async () => {
      if (!cid) return;
      const fs = unixfs(helia);
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const chunk of fs.cat(cid as any, { signal: ac.signal })) controller.enqueue(chunk);
            controller.close();
          } catch (e: any) {
            if (e?.name !== "AbortError") console.warn("audio fetch error", e);
          }
        }
      });
      const blob = await new Response(stream).blob();
      if (!revoked) setUrl(URL.createObjectURL(blob));
    })();
    return () => { ac.abort(); revoked = true; if (url) URL.revokeObjectURL(url); };
  }, [helia, cid]);
  return url;
}

export function PlayerProvider({ helia, children }: { helia: Helia; children: React.ReactNode }) {
  const [queue, setQueue] = useState<TrackEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | undefined>(undefined);
  const [analyser, setAnalyser] = useState<AnalyserNode | undefined>(undefined);

  const current = queue[index];
  const url = useObjectUrl(helia, current?.cid);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    const el = audioRef.current;
    function onTime() { setPosition(el.currentTime || 0); setDuration(el.duration || 0); }
    function onEnd() { next(); }
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnd);
    return () => { el.removeEventListener("timeupdate", onTime); el.removeEventListener("ended", onEnd); };
  }, []);

  // Setup Web Audio graph once user interacts (when we first try to play)
  function ensureAudioGraph() {
    if (!audioRef.current) return;
    if (!audioContext) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      setAudioContext(ctx);
      const src = ctx.createMediaElementSource(audioRef.current);
      const an = ctx.createAnalyser();
      an.fftSize = 256; // small for light visualization
      an.smoothingTimeConstant = 0.85;
      src.connect(an);
      an.connect(ctx.destination);
      setAnalyser(an);
    }
  }

  useEffect(() => {
    const el = audioRef.current!;
    if (url) {
      el.src = url; el.currentTime = 0;
      if (playing) el.play().catch(() => {});
    }
  }, [url]);

  useEffect(() => {
    if (!current) return;
    if ("mediaSession" in navigator) {
      try {
        // @ts-ignore
        navigator.mediaSession.metadata = new MediaMetadata({
          title: current.title || current.name,
          artist: current.artist,
          album: current.album,
          artwork: current.coverDataUrl ? [{ src: current.coverDataUrl, sizes: "300x300", type: "image/jpeg" }] : undefined
        });
        // @ts-ignore
        navigator.mediaSession.setActionHandler("previoustrack", () => prev());
        // @ts-ignore
        navigator.mediaSession.setActionHandler("nexttrack", () => next());
        // @ts-ignore
        navigator.mediaSession.setActionHandler("play", () => toggle());
        // @ts-ignore
        navigator.mediaSession.setActionHandler("pause", () => toggle());
      } catch {}
    }
  }, [current, playing]);

  function playTracks(tracks: TrackEntry[], startIndex = 0) {
    setQueue(tracks);
    setIndex(startIndex);
    setPlaying(true);
    setPosition(0);
    ensureAudioGraph();
    if (audioContext && audioContext.state === "suspended") audioContext.resume().catch(() => {});
  }
  function toggle() {
    const el = audioRef.current!;
    if (!el) return;
    ensureAudioGraph();
    if (audioContext && audioContext.state === "suspended") audioContext.resume().catch(() => {});
    if (playing) { el.pause(); setPlaying(false); } else { el.play().catch(() => {}); setPlaying(true); }
  }
  function next() { if (index < queue.length - 1) setIndex(i => i + 1); else setPlaying(false); }
  function prev() { if (index > 0) setIndex(i => i - 1); }
  function seek(sec: number) { const el = audioRef.current!; if (el) el.currentTime = sec; setPosition(sec); }

  const value = useMemo(() => ({
    queue, index, playing, current, playTracks, toggle, next, prev, seek, position, duration, analyser, audioContext
  }), [queue, index, playing, current, position, duration, analyser, audioContext]);
  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}

export function usePlayer() {
  const v = useContext(PlayerCtx);
  if (!v) throw new Error("usePlayer must be inside PlayerProvider");
  return v;
}
