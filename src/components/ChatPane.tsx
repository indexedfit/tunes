import React, { useEffect, useRef, useState } from "react";
import type { PlaylistDoc } from "../yjs/playlists";

export function ChatPane({ playlist }: { playlist: PlaylistDoc }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState(playlist.chat.toArray());
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const obs = () => setMsgs(playlist.chat.toArray());
    playlist.chat.observe(obs);
    return () => playlist.chat.unobserve(obs);
  }, [playlist.id]);
  const send = () => {
    const text = inputRef.current?.value.trim();
    if (!text) return;
    playlist.doc.transact(() =>
      playlist.chat.push([{ from: "me", ts: Date.now(), msg: text }]),
    );
    if (inputRef.current) inputRef.current.value = "";
  };
  return (
    <>
      <button className="chat-button" onClick={() => setOpen((s) => !s)}>
        💬
      </button>
      {open && (
        <div className="chat-panel">
          <div className="chat-messages">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`chat-message ${m.from === "me" ? "me" : "other"}`}
              >
                {m.msg}
              </div>
            ))}
          </div>
          <div className="chat-input-area">
            <input
              ref={inputRef}
              className="chat-input"
              placeholder="Type a message..."
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <button className="chat-send-btn" onClick={send}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
