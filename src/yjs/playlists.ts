import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { useEffect, useMemo, useState } from "react";
import type { PlaylistMeta, TrackMeta } from "../types";

export interface PlaylistDoc {
  id: string;
  meta: PlaylistMeta;
  tracks: Y.Array<TrackMeta>;
  chat: Y.Array<{ from: string; msg: string; ts: number }>;
  doc: Y.Doc;
}

interface Hook {
  playlists: PlaylistMeta[];
  current: PlaylistDoc;
  setCurrent: (idOrDoc: string | { id: string }) => void;
  ready: boolean;
}

export function usePlaylists(): Hook {
  const [ready, setReady] = useState(false);
  const [currentId, setCurrentId] = useState(
    () => location.hash?.slice(1) || "all",
  );

  const state = useMemo(() => {
    const doc = new Y.Doc();
    const playlistsMap = doc.getMap<Y.Map<any>>("playlists");
    const persistence = new IndexeddbPersistence("tunesfit-root", doc);
    persistence.once("synced", () => {
      if (!playlistsMap.has("all")) {
        const rec = new Y.Map();
        rec.set("info", { id: "all", name: "All Tracks" });
        rec.set("tracks", new Y.Array<TrackMeta>());
        rec.set("chat", new Y.Array());
        playlistsMap.set("all", rec);
      }
      setReady(true);
    });

    const get = (key: string): PlaylistDoc => {
      let rec = playlistsMap.get(key);
      if (!rec) rec = playlistsMap.get("all");
      const id = rec?.get("info")?.id || "all";
      return {
        id,
        meta: rec!.get("info"),
        tracks: rec!.get("tracks"),
        chat: rec!.get("chat"),
        doc,
      } as PlaylistDoc;
    };

    const allMeta = (): PlaylistMeta[] =>
      Array.from(playlistsMap.values()).map(
        (v) => v.get("info") as PlaylistMeta,
      );

    return { doc, playlistsMap, get, allMeta };
  }, []);

  useEffect(() => {
    const onHash = () => setCurrentId(location.hash?.slice(1) || "all");
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  const [list, setList] = useState<PlaylistMeta[]>([]);
  useEffect(() => {
    const update = () => setList(state.allMeta());
    state.playlistsMap.observe(update);
    update();
    return () => state.playlistsMap.unobserve(update);
  }, [state.playlistsMap, state]);

  const setCurrent = (a: any) => {
    const id = (a?.id ?? String(a)) || "all";
    setCurrentId(id);
    if (location.hash.slice(1) !== id) location.hash = id;
  };

  if (!ready) {
    return { playlists: [], current: null as any, setCurrent, ready: false };
  }
  const current = state.get(currentId);

  return { playlists: list, current, setCurrent, ready: true };
}
