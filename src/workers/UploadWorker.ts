/* eslint-disable no-restricted-globals */
import { fileToCid } from "../utils/hash";
interface Req {
  id: string;
  file: File;
  playlistId: string;
}
interface Res {
  id: string;
  progress?: number;
  meta?: { cid: string; type: string; name: string; playlistId: string };
}
self.onmessage = async (ev: MessageEvent<Req>) => {
  const { id, file, playlistId } = ev.data;
  console.log("Worker received:", { id, fileName: file.name, fileType: file.type, playlistId });
  try {
    const cid = await fileToCid(file);
    console.log("Generated CID:", cid);
    (postMessage as any)({ id, progress: 0.5 } as Res);
    (postMessage as any)({
      id,
      progress: 1,
      meta: { cid, type: file.type, name: file.name, playlistId },
    } as Res);
    console.log("Worker completed for:", file.name);
  } catch (error) {
    console.error("Worker error:", error);
  }
};
