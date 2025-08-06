/* eslint-disable no-restricted-globals */
import { fileToCid } from "../utils/hash";
interface Req {
  id: string;
  file: File;
  playlistId: string;
}
interface ProgressMsg {
  id: string;
  progress: number;
}
interface MetaMsg {
  id: string;
  meta: { cid: string; type: string; name: string; playlistId: string };
}

self.onmessage = async (ev: MessageEvent<Req>) => {
  const { id, file, playlistId } = ev.data;
  console.log("Worker received:", {
    id,
    fileName: file.name,
    fileType: file.type,
    playlistId,
  });
  try {
    const cid = await fileToCid(file);
    console.log("Generated CID:", cid);
    postMessage({ id, progress: 0.5 } as ProgressMsg);
    postMessage({
      id,
      meta: { cid, type: file.type, name: file.name, playlistId },
    } as MetaMsg);
    postMessage({ id, progress: 1 } as ProgressMsg);
    console.log("Worker completed for:", file.name);
  } catch (error) {
    console.error("Worker error:", error);
  }
};
