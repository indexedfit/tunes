import { useEffect, useState } from "react";
import { initHelia } from "./lib/helia";
import type { Manifest } from "./lib/manifest";
import {
  loadManifest,
  saveManifestToOpfs,
  persistManifestToIpfs,
  loadRootManifestFromIpfs,
  mergeManifests,
} from "./lib/manifest";
import { saveRoot } from "./lib/identity";
import PairingDialog from "./components/PairingDialog";
import PeerManager from "./components/PeerManager";
import LibraryView from "./components/LibraryView";
import PlaylistSidebar from "./components/PlaylistSidebar";
import PlaylistView from "./components/PlaylistView";
import { startSync } from "./lib/sync";
import { PlayerProvider } from "./player/PlayerContext";
import NowPlayingBar from "./components/NowPlayingBar";

export default function App() {
  const [helia, setHelia] = useState<any>(null);
  const [pairOpen, setPairOpen] = useState(false);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<
    string | undefined
  >(undefined);

  useEffect(() => {
    (async () => {
      const { helia } = await initHelia();
      setHelia(helia);
      const local = await loadManifest();
      setManifest(local);
      const fresher = await loadRootManifestFromIpfs(helia);
      if (fresher) {
        const merged = mergeManifests(local, fresher);
        await saveManifestToOpfs(merged);
        const cid = await persistManifestToIpfs(helia, merged);
        await saveRoot(cid.toString());
        setManifest(merged);
      }
      await startSync(helia, async (remoteCid) => {
        try {
          const dec = new TextDecoder();
          let text = "";
          for await (const chunk of (await import("@helia/unixfs"))
            .unixfs(helia)
            .cat(remoteCid as any))
            text += dec.decode(chunk, { stream: true });
          const remote = JSON.parse(text) as Manifest;
          const current = await loadManifest();
          const merged = mergeManifests(current, remote);
          await saveManifestToOpfs(merged);
          const cid = await persistManifestToIpfs(helia, merged);
          await saveRoot(cid);
          setManifest(merged);
        } catch (e) {
          console.warn("Failed to merge remote manifest", e);
        }
      });
    })();
  }, []);

  if (!helia || !manifest)
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-slate-600 mb-2">Starting node</div>
          <div className="animate-pulse">•••</div>
        </div>
      </div>
    );

  async function onManifestChange(next: Manifest, newCid: string | null) {
    setManifest(next);
    if (newCid) await saveRoot(newCid);
  }

  // Playlist mutators
  async function createPlaylist() {
    if (!manifest) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const next: Manifest = {
      ...manifest,
      playlists: {
        ...(manifest.playlists || {}),
        [id]: { id, name: "New Playlist", trackIds: [], createdAt: now },
      },
    };
    await saveManifestToOpfs(next);
    const rc = await persistManifestToIpfs(helia, next);
    setManifest(next);
    onManifestChange(next, rc);
    setSelectedPlaylistId(id);
  }
  async function renamePlaylist(id: string, name: string) {
    if (!manifest) return;
    const p = manifest.playlists?.[id];
    if (!p) return;
    const now = new Date().toISOString();
    const next: Manifest = {
      ...manifest,
      playlists: {
        ...manifest.playlists,
        [id]: { ...p, name, updatedAt: now },
      },
    };
    await saveManifestToOpfs(next);
    const rc = await persistManifestToIpfs(helia, next);
    setManifest(next);
    onManifestChange(next, rc);
  }
  async function deletePlaylist(id: string) {
    if (!manifest) return;
    const p = manifest.playlists?.[id];
    if (!p) return;
    const now = new Date().toISOString();
    const next: Manifest = {
      ...manifest,
      playlists: {
        ...manifest.playlists,
        [id]: { ...p, deleted: true, updatedAt: now },
      },
    };
    await saveManifestToOpfs(next);
    const rc = await persistManifestToIpfs(helia, next);
    setManifest(next);
    onManifestChange(next, rc);
    if (selectedPlaylistId === id) setSelectedPlaylistId(undefined);
  }
  async function removeTrackFromSelected(trackId: string) {
    if (!manifest || !selectedPlaylistId) return;
    const p = manifest.playlists![selectedPlaylistId];
    const now = new Date().toISOString();
    const next: Manifest = {
      ...manifest,
      playlists: {
        ...manifest.playlists,
        [p.id]: {
          ...p,
          trackIds: p.trackIds.filter((id) => id !== trackId),
          updatedAt: now,
        },
      },
    };
    await saveManifestToOpfs(next);
    const rc = await persistManifestToIpfs(helia, next);
    setManifest(next);
    onManifestChange(next, rc);
  }
  async function reorderSelected(from: number, to: number) {
    if (!manifest || !selectedPlaylistId) return;
    const p = manifest.playlists![selectedPlaylistId];
    const ids = [...p.trackIds];
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    const now = new Date().toISOString();
    const next: Manifest = {
      ...manifest,
      playlists: {
        ...manifest.playlists,
        [p.id]: { ...p, trackIds: ids, updatedAt: now },
      },
    };
    await saveManifestToOpfs(next);
    const rc = await persistManifestToIpfs(helia, next);
    setManifest(next);
    onManifestChange(next, rc);
  }

  return (
    <PlayerProvider helia={helia}>
      <div className="min-h-screen pb-28">
        <header className="bg-white border-b border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
            <h1 className="text-xl font-semibold">tunes.fit</h1>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setPairOpen(true)}
                className="btn btn-secondary"
              >
                Pair Device
              </button>
              <a
                href="https://indexed.fit"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-800 font-medium"
              >
                indexed.fit
              </a>
            </div>
          </div>
        </header>

        <main className="max-w-screen-2xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-[16rem,1fr]">
            <PlaylistSidebar
              manifest={manifest}
              selectedId={selectedPlaylistId}
              onSelect={setSelectedPlaylistId}
              onCreate={createPlaylist}
              onRename={renamePlaylist}
              onDelete={deletePlaylist}
            />
            {selectedPlaylistId ? (
              <PlaylistView
                helia={helia}
                manifest={manifest}
                playlistId={selectedPlaylistId}
                onRemoveTrack={removeTrackFromSelected}
                onReorder={reorderSelected}
              />
            ) : (
              <LibraryView helia={helia} onManifestChange={onManifestChange} />
            )}
          </div>
        </main>

        <footer className="border-t border-slate-200 mt-8 p-4">
          <div className="max-w-screen-2xl mx-auto grid md:grid-cols-2 gap-4">
            <div className="box p-4">
              <PeerManager helia={helia} />
            </div>
            <div className="box p-4 text-sm text-slate-600">
              <h3 className="font-semibold mb-2">System Info</h3>
              <ul className="space-y-1 text-xs">
                <li>• Manifest + peers: OPFS storage</li>
                <li>• Media blocks: OPFS blockstore</li>
                <li>• Network: libp2p + circuit relay</li>
              </ul>
            </div>
          </div>
        </footer>

        <PairingDialog
          open={pairOpen}
          onClose={() => setPairOpen(false)}
          helia={helia}
        />
        <NowPlayingBar />
      </div>
    </PlayerProvider>
  );
}
