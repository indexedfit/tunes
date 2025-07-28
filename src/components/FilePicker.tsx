import { ChangeEvent, useRef, useState, DragEvent } from "react";
import type { Helia } from "helia";
import { unixfs } from "@helia/unixfs";

interface Props {
  helia: Helia;
  onAdded: (entries: {
    id: string; cid: string; name: string; size?: number; mime?: string;
    title?: string; artist?: string; album?: string; durationSec?: number; coverDataUrl?: string;
  }[]) => void;
}

export default function FilePicker({ helia, onAdded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  async function extractTags(file: File): Promise<Partial<{
    title: string; artist: string; album: string; durationSec: number; coverDataUrl: string;
  }>> {
    try {
      const { parseBlob } = await import("music-metadata-browser");
      const metadata = await parseBlob(file);
      const common = metadata.common || {};
      const fmt = metadata.format || {};
      let coverDataUrl: string | undefined;
      const picture = (common.picture && common.picture[0]) || undefined;
      if (picture && picture.data) {
        const blob = new Blob([picture.data], { type: picture.format || "image/jpeg" });
        coverDataUrl = URL.createObjectURL(blob);
      }
      return {
        title: common.title || undefined,
        artist: common.artist || undefined,
        album: common.album || undefined,
        durationSec: typeof fmt.duration === "number" ? Math.round(fmt.duration) : undefined,
        coverDataUrl
      };
    } catch (e) {
      console.warn("tag parse failed", e);
      return {};
    }
  }

  async function handleFiles(files: FileList) {
    if (!files.length) return;
    setIsUploading(true);
    const fs = unixfs(helia);
    const results: any[] = [];
    try {
      for (const file of Array.from(files)) {
        const arrayBuffer = await file.arrayBuffer();
        const cid = await fs.addBytes(new Uint8Array(arrayBuffer));
        const tags = await extractTags(file);
        results.push({
          id: crypto.randomUUID(),
          cid: cid.toString(),
          name: file.name,
          size: file.size,
          mime: file.type || undefined,
          ...tags,
        });
      }
      onAdded(results);
    } finally { setIsUploading(false); }
  }

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      await handleFiles(e.target.files);
      e.currentTarget.value = "";
    }
  }

  function handleDragOver(e: DragEvent) { e.preventDefault(); setIsDragging(true); }
  function handleDragLeave(e: DragEvent) { e.preventDefault(); setIsDragging(false); }
  async function handleDrop(e: DragEvent) { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) await handleFiles(e.dataTransfer.files); }

  return (
    <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300'}`}
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <input ref={inputRef} type="file" accept="audio/*" multiple onChange={handleChange} className="hidden" />
      {isUploading ? (
        <div className="text-slate-600"><div className="animate-spin h-8 w-8 border-2 border-slate-300 border-t-indigo-500 rounded-full mx-auto mb-2"></div><p>Uploading…</p></div>
      ) : (
        <>
          <button onClick={() => inputRef.current?.click()} className="btn btn-primary mb-3">Add tracks</button>
          <p className="text-sm text-slate-500">or drag & drop audio files</p>
        </>
      )}
    </div>
  );
}
