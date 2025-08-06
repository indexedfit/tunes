import React, { useRef, useState, useEffect } from "react";
import * as Y from "yjs";
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

  // Setup worker only once and handle its lifecycle
  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/UploadWorker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    worker.onmessage = async (ev: MessageEvent<WorkerMsg>) => {
      const { id, progress: p, meta } = ev.data;

      // Handle progress updates
      if (p !== undefined) {
        setProgress((prev) => new Map(prev).set(id, p));
      }

      // If there's no metadata, we're done with this message.
      // We only proceed to add the track to Yjs/OPFS when we receive the `meta` object.
      if (!meta) {
        return;
      }

      const file = pending.current.get(id);
      if (!file) {
        console.error(`Pending file not found for upload id: ${id}`);
        return;
      }

      const baseTrack: TrackMeta = {
        cid: meta.cid,
        type: meta.type || "audio/mpeg",
        name: meta.name || file.name,
        ts: Date.now(),
      };

      console.log("Processing uploaded track:", baseTrack);

      playlist.doc.transact(() => {
        const registry = playlist.registry;

        // 1. Add to global registry if it's not there.
        if (!registry.has(baseTrack.cid)) {
          registry.set(baseTrack.cid, baseTrack);
          console.log("Track added to registry:", baseTrack.cid);
        } else {
          console.log("Track already exists in registry:", baseTrack.cid);
        }

        // 2. Add to the target playlist that initiated the upload.
        if (meta.playlistId !== "all") {
          const playlistsMap = playlist.doc.getMap<Y.Map<any>>("playlists");
          const targetPlaylistRecord = playlistsMap.get(meta.playlistId);

          if (targetPlaylistRecord) {
            const targetItems = targetPlaylistRecord.get(
              "items",
            ) as Y.Array<string>;
            if (!targetItems.toArray().includes(baseTrack.cid)) {
              targetItems.push([baseTrack.cid]);
              console.log(
                `Track added to target playlist ID: "${meta.playlistId}"`,
              );
            }
          } else {
            console.warn(
              `Upload target playlist with ID "${meta.playlistId}" not found.`,
            );
          }
        }
      });

      // Background save (dedup at OPFS level)
      try {
        console.log("Saving track to OPFS:", meta.cid);
        await saveTrack(meta.cid, file);
        console.log("Track saved successfully");
      } catch (e) {
        console.error("saveTrack failed", e);
      } finally {
        // Final cleanup for this upload
        pending.current.delete(id);
        setProgress((prev) => {
          const n = new Map(prev);
          n.delete(id);
          return n;
        });
      }
    };

    worker.onerror = (e) => console.error("Worker error:", e);

    // Terminate worker on component unmount
    return () => {
      worker.terminate();
    };
  }, [playlist.doc]); // Dependency on playlist.doc ensures logic re-runs if the core Yjs doc changes

  const onChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = Array.from(e.target.files ?? []);
    if (!workerRef.current) return;

    files.forEach((file) => {
      const id = crypto.randomUUID();
      pending.current.set(id, file);
      setProgress((p) => new Map(p).set(id, 0));
      workerRef.current!.postMessage({ id, file, playlistId: playlist.id });
    });

    if (e.currentTarget) {
      e.currentTarget.value = "";
    }
  };

  const vals = Array.from(progress.values());
  const globalProgress = vals.length
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
            style={{ width: `${globalProgress * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
