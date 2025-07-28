import { useEffect, useState } from "react";
import type { Helia } from "helia";
import { loadManifest, Manifest, saveManifestToOpfs, persistManifestToIpfs } from "../lib/manifest";
import FilePicker from "./FilePicker";
import TrackRow from "./TrackRow";
import TrackActionsMenu from "./TrackActionsMenu";

export default function LibraryView({ helia, onManifestChange }: { helia: Helia; onManifestChange: (m: Manifest, newCid: string | null) => void; }) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [menu, setMenu] = useState<{ trackId: string; x: number; y: number } | null>(null);

  useEffect(() => { (async () => setManifest(await loadManifest()))(); }, []);

  async function addEntries(entries: any[]) {
    if (!manifest) return;
    const now = new Date().toISOString();
    const next: Manifest = { ...manifest, tracks: { ...manifest.tracks } };
    for (const e of entries) {
      next.tracks[e.id] = {
        id: e.id, cid: e.cid, name: e.name,
        size: e.size, mime: e.mime, addedAt: now,
        title: e.title, artist: e.artist, album: e.album, durationSec: e.durationSec, coverDataUrl: e.coverDataUrl
      };
    }
    await saveManifestToOpfs(next);
    const rootCid = await persistManifestToIpfs(helia, next);
    setManifest(next); onManifestChange(next, rootCid);
  }

  async function removeEntry(id: string) {
    if (!manifest) return;
    const t = manifest.tracks[id]; if (!t) return;
    const now = new Date().toISOString();
    const next: Manifest = { ...manifest, tracks: { ...manifest.tracks, [id]: { ...t, deleted: true, updatedAt: now } } };
    await saveManifestToOpfs(next);
    const rc = await persistManifestToIpfs(helia, next);
    setManifest(next); onManifestChange(next, rc);
  }

  async function addTrackToPlaylist(trackId: string, playlistId: string) {
    if (!manifest) return;
    const p = manifest.playlists?.[playlistId]; if (!p) return;
    const now = new Date().toISOString();
    const next: Manifest = { ...manifest, playlists: { ...manifest.playlists, [p.id]: { ...p, trackIds: [...p.trackIds, trackId], updatedAt: now } } };
    await saveManifestToOpfs(next);
    const rc = await persistManifestToIpfs(helia, next);
    setManifest(next); onManifestChange(next, rc);
  }

  async function createPlaylistAndAdd(trackId: string) {
    if (!manifest) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const playlist = { id, name: "New Playlist", trackIds: [trackId], createdAt: now, updatedAt: now };
    const next: Manifest = { ...manifest, playlists: { ...(manifest.playlists || {}), [id]: playlist } };
    await saveManifestToOpfs(next);
    const rc = await persistManifestToIpfs(helia, next);
    setManifest(next); onManifestChange(next, rc);
  }

  if (!manifest) return <p className="text-slate-500 font-mono">Loading library…</p>;
  const visible = Object.values(manifest.tracks).filter(t => !t.deleted);

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-medium">All Tracks</h2>
          <p className="text-sm text-slate-500">{visible.length} items</p>
        </div>
        <div className="space-y-1">
          {visible.map((t, idx) => (
            <TrackRow key={t.id} helia={helia} track={t} index={idx}
                      onMenu={(trackId, pos) => setMenu({ trackId, x: pos.x, y: pos.y })}
                      onDelete={removeEntry} />
          ))}
        </div>
        {visible.length === 0 && <div className="text-center py-12 text-slate-500"><p className="mb-2">No tracks yet</p><p className="text-sm">Click "Add tracks" below to get started</p></div>}
        <div className="mt-8 border-t pt-6">
          <FilePicker helia={helia} onAdded={addEntries} />
        </div>
      </div>

      {menu && (
        <TrackActionsMenu
          manifest={manifest}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onAddToPlaylist={(pid) => addTrackToPlaylist(menu.trackId, pid)}
          onCreateAndAdd={() => createPlaylistAndAdd(menu.trackId)}
          onDelete={() => removeEntry(menu.trackId)}
        />
      )}
    </div>
  );
}
