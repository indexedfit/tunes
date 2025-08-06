import React, { useEffect, useState } from "react";
import { usePlaylists } from "./yjs/playlists";
import { PlaylistSelector } from "./components/PlaylistSelector";
import { UploadButton } from "./components/UploadButton";
import { TrackList } from "./components/TrackList";
import { Player } from "./components/Player";
import { ChatPane } from "./components/ChatPane";
import type { TrackMeta } from "./types";

export default function App() {
  const { playlists, current, setCurrent, ready } = usePlaylists();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [playIndex, setPlayIndex] = useState<number | null>(null);

  useEffect(() => {
    if (ready && current) {
      setSelected(new Set());
      setPlayIndex(null);
    }
  }, [current?.id, ready]);

  if (!ready || !current) return null;
  const queue: TrackMeta[] = current.items.toArray().map(cid => current.registry.get(cid)).filter(Boolean) as TrackMeta[];

  const setTrackDuration = (cid: string, dur: number) => {
    current.doc.transact(() => {
      const cur = current.registry.get(cid);
      if (cur && (!cur.duration || Math.abs((cur.duration || 0) - dur) > 0.5)) {
        current.registry.set(cid, { ...cur, duration: dur });
      }
    });
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <PlaylistSelector
          playlists={playlists}
          current={current}
          onSelect={(id) => setCurrent(id)}
        />
      </aside>
      <div className="main-content">
        <header className="header">
          <div style={{ fontWeight: 700 }}>🎵 tunes.fit</div>
          <div className="flex-1" />
          <UploadButton key={current.id} playlist={current} />
        </header>
        <main className="content-area">
          <TrackList
            playlist={current}
            selected={selected}
            onSelectionChange={setSelected}
            onPlay={(i) => setPlayIndex(i)}
          />
        </main>
      </div>
      <ChatPane playlist={current} />
      <div className="player-dock">
        <Player
          queue={queue}
          index={playIndex}
          setIndex={setPlayIndex}
          onDuration={setTrackDuration}
        />
      </div>
    </div>
  );
}
