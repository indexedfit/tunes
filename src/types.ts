export interface TrackMeta {
  cid: string;
  name: string;
  type: string;
  ts: number;
  playlistId: string;
  duration?: number; // filled later by <audio> when it can play
}

export interface PlaylistMeta {
  id: string;
  name: string;
}
