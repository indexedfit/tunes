import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import { base32 } from "multiformats/bases/base32";

export async function fileToCid(file: Blob): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const hash = await sha256.digest(buf);
  return CID.create(1, 0x55, hash).toString(base32.encoder); // 0x55 raw
}
