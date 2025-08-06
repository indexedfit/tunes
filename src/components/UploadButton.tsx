import React, { useRef, useState, useEffect } from "react";
import { UploadIcon } from "lucide-react";
import type { PlaylistDoc } from "../yjs/playlists";
import type { TrackMeta } from "../types";
import { saveTrack } from "../utils/opfs";

interface WorkerMsg {
  id: string;
  progress?: number;
  meta?: { cid: string; type: string; name: string; playlistId: string };
}

export function UploadButton({ playlist }: { playlist: PlaylistDoc }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<Map<string, number>>(new Map());
  const pending = useRef<Map<string, File>>(new Map());
  const workerRef = useRef<Worker>();
  
  console.log("UploadButton render, playlist:", playlist?.id, "tracks count:", playlist?.tracks?.length);

  if (!workerRef.current) {
    workerRef.current = new Worker(
      new URL("../workers/UploadWorker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current.onmessage = async (ev: MessageEvent<WorkerMsg>) => {
      try {
        const { id, progress: p, meta } = ev.data;
        console.log("Worker message:", { id, progress: p, meta: meta ? JSON.stringify(meta) : meta });
        if (p !== undefined) {
          setProgress((prev) => new Map(prev).set(id, p));
          if (!meta) return; // Only return early if no meta data
        }
        console.log("Processing non-progress message for id:", id);
        const file = pending.current.get(id);
        console.log("File for id:", id, file?.name, "Meta:", meta);
        if (!file || !meta) {
          console.log("Missing file or meta, returning early. File:", !!file, "Meta:", !!meta);
          return;
        }

        // 1) Push a stub immediately so the row appears
        const baseTrack: TrackMeta = {
          cid: meta.cid,
          type: meta.type || "audio/mpeg",
          name: meta.name || file.name,
          playlistId: meta.playlistId,
          ts: Date.now(),
        };
        console.log("Adding track to playlist:", baseTrack);
        playlist.doc.transact(() => {
          if (!playlist.tracks.toArray().some(t => t.cid === baseTrack.cid)) {
            playlist.tracks.push([baseTrack]);
            console.log("Track added, new count:", playlist.tracks.length);
          } else {
            console.log("Track already exists with CID:", baseTrack.cid);
          }
        });

        // 2) Background save (best-effort)
        try {
          console.log("Saving track to OPFS:", meta.cid);
          await saveTrack(meta.cid, file);
          console.log("Track saved successfully");
        } catch (e) {
          console.error("saveTrack failed", e);
        } finally {
          pending.current.delete(id);
          setProgress(prev => { const n = new Map(prev); n.delete(id); return n; });
        }
      } catch (error) {
        console.error("Error in message handler:", error);
      }
    };
    workerRef.current.onerror = console.error;
  }

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = undefined;
    };
  }, []);

  const onChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = Array.from(e.target.files ?? []);
    console.log("Files selected:", files.length, files.map(f => f.name + " (" + f.type + ")"));
    files.forEach((file) => {
      console.log("Processing file:", file.name, file.type);
      const id = crypto.randomUUID();
      pending.current.set(id, file);
      setProgress((p) => new Map(p).set(id, 0));
      console.log("Sending to worker with playlistId:", playlist.id);
      workerRef.current!.postMessage({ id, file, playlistId: playlist.id });
    });
    e.currentTarget.value = "";
  };

  const vals = Array.from(progress.values());
  const global = vals.length
    ? vals.reduce((a, b) => a + b, 0) / vals.length
    : 0;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,application/octet-stream"
        multiple
        hidden
        onChange={onChange}
      />
      <button
        className="upload-button"
        onClick={() => inputRef.current?.click()}
      >
        <UploadIcon size={16} /> Import audio
      </button>
      {vals.length > 0 && (
        <div className="upload-progress">
          <div
            className="upload-progress-bar"
            style={{ width: `${global * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

