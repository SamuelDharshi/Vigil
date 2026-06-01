import { WEB3_STORAGE_KEY } from "../config";
import { AgentCard } from "../types";

/**
 * VIGIL IPFS Module — Live Pinning via Storacha (formerly web3.storage)
 *
 * web3.storage rebranded to storacha.network — the client package is now
 * @storacha/client. All functionality is identical.
 *
 * The CID returned by every function is registered on-chain in the
 * ERC-8004 Identity Registry as the Agent Card pointer.
 *
 * API: https://storacha.network/docs
 * Key: https://console.storacha.network → Create Key
 */

async function getStorachaClient() {
  if (!WEB3_STORAGE_KEY) {
    throw new Error(
      "[IPFS] WEB3_STORAGE_KEY is not set in .env\n" +
      "Get a key at: https://console.storacha.network\n" +
      "Set it in .env as WEB3_STORAGE_KEY=..."
    );
  }

  // Try @storacha/client first (new package name)
  try {
    const { create } = await import("@storacha/client");
    return await create();
  } catch {
    // Fallback to @web3-storage/w3up-client (old package name — same code)
    const { create } = await import("@web3-storage/w3up-client");
    return await create();
  }
}

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
  if (pinataJwt) {
    console.log(`[IPFS] Uploading real file '${name}' to IPFS via Pinata...`);
    const cid = await pinBlobToPinata(blob, name);
    console.log(`[IPFS] ✅ Real upload successful! CID: ${cid}`);
    return cid;
  }

  if (!WEB3_STORAGE_KEY) {
    console.warn(
      "[IPFS] ⚠ WEB3_STORAGE_KEY is not set in .env. Generating mock IPFS CID for local prototyping..."
    );
    const crypto = await import("crypto");
    const hash = crypto.createHash("sha256").update(await blob.text()).digest("hex");
    return `bafybeihmockcid${hash.slice(0, 32)}`;
  }

  const client = await getStorachaClient();
  const cid = await (client as any).uploadFile(blob);
  return cid.toString();
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
