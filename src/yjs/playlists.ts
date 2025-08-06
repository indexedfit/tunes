import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { useEffect, useMemo, useState } from "react";
import type { PlaylistMeta, TrackMeta } from "../types";

export interface PlaylistDoc {
  id: string;
  meta: PlaylistMeta;
  /** CIDs only in this playlist */
  items: Y.Array<string>;
  chat: Y.Array<{ from: string; msg: string; ts: number }>;
  /** Root doc and registry (global canonical tracks) */
  doc: Y.Doc;
  registry: Y.Map<TrackMeta>;
}

interface Hook {
  playlists: PlaylistMeta[];
  current: PlaylistDoc;
  setCurrent: (idOrDoc: string | { id: string }) => void;
  ready: boolean;
}

/** Idempotent schema/migration:
 *  - ensure registry Y.Map<TrackMeta> at key "tracks"
 *  - ensure each playlist has "items" (Y.Array<string>) and migrate old "tracks" arrays if present
 *  - ensure there is an "all" playlist
 */
function ensureSchema(doc: Y.Doc) {
  const playlistsMap = doc.getMap<Y.Map<any>>("playlists");
  const registry = doc.getMap<TrackMeta>("tracks");

  doc.transact(() => {
    if (!playlistsMap.has("all")) {
      const rec = new Y.Map();
      rec.set("info", { id: "all", name: "All Tracks" });
      rec.set("items", new Y.Array<string>());
      rec.set("chat", new Y.Array());
      playlistsMap.set("all", rec);
    }

    // migrate any playlist missing items (old: "tracks": Y.Array<TrackMeta>)
    playlistsMap.forEach((rec) => {
      let items = rec.get("items") as Y.Array<string>;
      if (!items) {
        items = new Y.Array<string>();
        rec.set("items", items);
      }

      const old = rec.get("tracks") as Y.Array<any> | undefined;
      if (old && old.length > 0) {
        // move TrackMeta objects to registry + push cid to items
        (old.toArray() as TrackMeta[]).forEach((t) => {
          if (t && t.cid) {
            if (!registry.get(t.cid)) {
              registry.set(t.cid, {
                cid: t.cid,
                name: t.name,
                type: t.type,
                ts: t.ts,
                duration: t.duration,
              });
            }
            if (!items.toArray().includes(t.cid)) items.push([t.cid]);
          }
        });
        // remove legacy key
        rec.delete("tracks");
      }
    });
  });

  return { playlistsMap, registry };
}

export function usePlaylists(): Hook {
  const [ready, setReady] = useState(false);
  const [currentId, setCurrentId] = useState(
    () => location.hash?.slice(1) || "all",
  );

  const state = useMemo(() => {
    const doc = new Y.Doc();
    const persistence = new IndexeddbPersistence("tunesfit-root", doc);
    const { playlistsMap, registry } = ensureSchema(doc);

    // ARCHITECTURE IMPROVEMENT:
    // Observe the global track registry. Whenever a track is added, ensure
    // it's also in the "All Tracks" playlist. This centralizes the logic.
    registry.observe((event) => {
      const allRec = playlistsMap.get("all");
      if (!allRec) return; // Should not happen after ensureSchema
      const allItems = allRec.get("items") as Y.Array<string>;
      const allItemsSet = new Set(allItems.toArray());

      doc.transact(() => {
        event.changes.keys.forEach((change, cid) => {
          // If a new track was added to the registry and is not already in "All Tracks"
          if (change.action === "add" && !allItemsSet.has(cid)) {
            allItems.push([cid]);
          }
          // Note: Deletion from registry could also trigger deletion from "All Tracks"
          // but we'll omit that for now as it's not part of the current app flow.
        });
      });
    });

    persistence.once("synced", () => {
      ensureSchema(doc); // Re-run to be safe, Yjs handles idempotency

      // One-time sync to catch any tracks missed before observer was set
      const allRec = playlistsMap.get("all")!;
      const allItems = allRec.get("items") as Y.Array<string>;
      const have = new Set(allItems.toArray());
      doc.transact(() => {
        registry.forEach((_v, cid) => {
          if (!have.has(cid)) allItems.push([cid]);
        });
      });

      setReady(true);
    });

    const get = (key: string): PlaylistDoc => {
      let rec = playlistsMap.get(key);
      if (!rec) rec = playlistsMap.get("all");
      const id = rec?.get("info")?.id || "all";
      return {
        id,
        meta: rec!.get("info"),
        items: rec!.get("items"),
        chat: rec!.get("chat"),
        doc,
        registry,
      } as PlaylistDoc;
    };

    const allMeta = (): PlaylistMeta[] => {
      const out: PlaylistMeta[] = [];
      playlistsMap.forEach((v) => {
        const info = v.get("info") as PlaylistMeta | undefined;
        if (info) out.push(info);
      });
      return out;
    };

    return { doc, get, allMeta, playlistsMap, registry };
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
    // No longer need to observe registry here for list updates,
    // but keeping it is fine if other logic depends on it.
    state.registry.observe(update);
    update();
    return () => {
      state.playlistsMap.unobserve(update);
      state.registry.unobserve(update);
    };
  }, [state.playlistsMap, state.registry, state]);

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
