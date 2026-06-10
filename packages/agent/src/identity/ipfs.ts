import { AgentCard } from "../types";

async function pinBlobToPinata(blob: Blob, name: string): Promise<string> {
  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt) {
    throw new Error("PINATA_JWT is not set in .env");
  }

  const text = await blob.text();
  let jsonContent;
  try {
    jsonContent = JSON.parse(text);
  } catch {
    jsonContent = { raw: text };
  }

  const axios = (await import("axios")).default;
  const response = await axios.post(
    "https://api.pinata.cloud/pinning/pinJSONToIPFS",
    {
      pinataContent: jsonContent,
      pinataMetadata: {
        name: name,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${pinataJwt}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.IpfsHash;
}

async function pinBlob(blob: Blob, name: string = "file.json"): Promise<string> {
  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt || pinataJwt === "") {
    throw new Error("IPFSUploadError: PINATA_JWT is not configured in .env. Real IPFS upload required.");
  }
  console.log(`[IPFS] Uploading real file '${name}' to IPFS via Pinata...`);
  const cid = await pinBlobToPinata(blob, name);
  console.log(`[IPFS] ✅ Real upload successful! CID: ${cid}`);
  return cid;
}

const bigintReplacer = (key: string, value: any) =>
  typeof value === "bigint" ? value.toString() : value;

/**
 * Pin Agent Card JSON to IPFS/Filecoin.
 * Returns the live CID for on-chain registration in ERC-8004 Identity Registry.
 */
export async function pinAgentCard(agentCard: AgentCard): Promise<string> {
  console.log("[IPFS] Pinning Agent Card to IPFS...");
  const blob = new Blob([JSON.stringify(agentCard, bigintReplacer, 2)], { type: "application/json" });
  const cid  = await pinBlob(blob, "agent-card.json");
  console.log(`[IPFS] ✅ Agent Card pinned: ${cid}`);
  console.log(`[IPFS]    Gateway: https://${cid}.ipfs.w3s.link`);
  return cid;
}

/**
 * Pin a signal bundle JSON to IPFS.
 * The CID becomes the signalBundleHash logged in VIGILLedger.
 */
export async function pinSignalBundle(bundleId: string, bundle: object): Promise<string> {
  console.log(`[IPFS] Pinning signal bundle ${bundleId}...`);
  const blob = new Blob([JSON.stringify(bundle, bigintReplacer)], { type: "application/json" });
  const cid  = await pinBlob(blob, `signal-bundle-${bundleId}.json`);
  console.log(`[IPFS] Signal bundle pinned: ${cid}`);
  return cid;
}

/**
 * Pin proof metadata to IPFS for ERC-8004 Reputation Registry.
 * The CID is passed as metadataCid in submitFeedback().
 */
export async function pinProofMetadata(metadata: object): Promise<string> {
  console.log("[IPFS] Pinning proof metadata...");
  const blob = new Blob([JSON.stringify(metadata, bigintReplacer)], { type: "application/json" });
  const cid  = await pinBlob(blob, "proof-metadata.json");
  console.log(`[IPFS] Proof metadata pinned: ${cid}`);
  return cid;
}
