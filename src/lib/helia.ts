import { createHelia } from "helia";
import { OPFSBlockstore } from "blockstore-opfs";
import { createDelegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client';
import { createLibp2p } from "libp2p";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webTransport } from "@libp2p/webtransport";
import { webSockets } from "@libp2p/websockets";
import { all as wsAll } from "@libp2p/websockets/filters";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery';
import { ping } from '@libp2p/ping';
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify } from "@libp2p/identify";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { bootstrap } from "@libp2p/bootstrap";
import { peerIdFromString } from '@libp2p/peer-id';
import first from 'it-first';
import { loadConfig } from "./config";

const BOOTSTRAP_PEER_IDS = [
  "QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
  "QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa", 
  "QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
  "QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt"
];

interface PeerInfo {
  ID: string;
  Addrs: Array<{
    protoNames(): string[];
    nodeAddress(): { address: string };
    toString(): string;
  }>;
}

async function getRelayListenAddrs(client: any): Promise<string[]> {
  try {
    const peers = await Promise.all(
      BOOTSTRAP_PEER_IDS.map(async (peerId) => {
        try { return await first(client.getPeers(peerIdFromString(peerId))) as PeerInfo; }
        catch { return null; }
      })
    );
    const relayListenAddrs = [];
    for (const p of peers) {
      if (p && p.Addrs.length > 0) {
        for (const maddr of p.Addrs) {
          const protos = maddr.protoNames();
          if (protos.includes('tls') && protos.includes('ws')) {
            if (maddr.nodeAddress().address === '127.0.0.1') continue;
            relayListenAddrs.push(`${maddr.toString()}/p2p/${p.ID}/p2p-circuit`);
          }
        }
      }
    }
    return relayListenAddrs;
  } catch { return []; }
}

export async function initHelia() {
  const cfg = await loadConfig();
  if (typeof navigator.storage === 'undefined' || !navigator.storage?.getDirectory)
    throw new Error("OPFS not supported on this browser/device");

  const store = new OPFSBlockstore(cfg.blockstoreName);
  await store.open();

  const delegatedClient = createDelegatedRoutingV1HttpApiClient('https://delegated-ipfs.dev');
  let relayListenAddrs: string[] = [];
  try { relayListenAddrs = await getRelayListenAddrs(delegatedClient); } catch {}

  const bootstrapList = [
    "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
    "/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa",
    "/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
    "/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt",
    ...cfg.relayAddrs,
    ...relayListenAddrs
  ];

  const libp2p = await createLibp2p({
    addresses: { listen: ['/webrtc'] },
    transports: [webTransport(), webSockets({ filter: wsAll }), webRTC(), webRTCDirect(), circuitRelayTransport()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    connectionGater: { denyDialMultiaddr: async () => false },
    peerDiscovery: [pubsubPeerDiscovery({ interval: 10_000, topics: [`${cfg.pubsubNamespace}-discovery`], listenOnly: false }), bootstrap({ list: bootstrapList })],
    services: {
      pubsub: gossipsub({ allowPublishToZeroTopicPeers: true, ignoreDuplicatePublishError: true }),
      delegatedRouting: () => delegatedClient,
      identify: identify() as any,
      ping: ping()
    }
  });

  const helia = await createHelia({ blockstore: store, libp2p: libp2p as any });
  return { helia: helia as any };
}
