import {
  CronCapability,
  EVMClient,
  HTTPClient,
  Runner,
  LATEST_BLOCK_NUMBER,
  bytesToHex,
  consensusIdenticalAggregation,
  encodeCallMsg,
  getNetwork,
  handler,
  json,
  ok,
  type Runtime,
} from "@chainlink/cre-sdk"
import { decodeFunctionResult, encodeFunctionData, parseAbi, zeroAddress, type Address } from "viem"
import { z } from "zod"

/**
 * Vigil's risk monitor, as a Chainlink CRE workflow.
 *
 *   1. TRIGGER on a cron schedule.
 *   2. READ Mantle Sepolia: VIGILLedger entries, and VIGILVault decisions and skips.
 *   3. CALL external APIs over HTTPS: Fear & Greed and ETH's 24h move.
 *   4. DECIDE a posture with deterministic rules: NORMAL, CAUTION or HALT_ENTRIES.
 *
 * It reads and recommends only. It holds no key, sends no transaction and cannot trade.
 * If market data is unavailable the posture is CAUTION, and no value is substituted.
 */

const configSchema = z.object({
  schedule: z.string(),
  chainSelectorName: z.string(),
  ledgerAddress: z.string(),
  vaultAddress: z.string(),
  fearGreedUrl: z.string(),
  priceUrl: z.string(),
  cautionFearGreed: z.number(),
  haltDropPct: z.number(),
})
type Config = z.infer<typeof configSchema>

const ABI = parseAbi([
  "function totalEntries() view returns (uint256)",
  "function totalDecisions() view returns (uint256)",
  "function totalSkipped() view returns (uint256)",
])
type Fn = "totalEntries" | "totalDecisions" | "totalSkipped"
type Fetched = { status: number; body: string }

const readCount = (runtime: Runtime<Config>, evm: EVMClient, to: string, functionName: Fn): bigint => {
  const reply = evm
    .callContract(runtime, {
      call: encodeCallMsg({ from: zeroAddress, to: to as Address, data: encodeFunctionData({ abi: ABI, functionName }) }),
      blockNumber: LATEST_BLOCK_NUMBER,
    })
    .result()
  return decodeFunctionResult({ abi: ABI, functionName, data: bytesToHex(reply.data) }) as bigint
}

/** One node fetches (cacheSettings) and consensus confirms the same answer. */
const fetchJson = (runtime: Runtime<Config>, target: string): any | null => {
  const result = new HTTPClient()
    .sendRequest(
      runtime,
      (sendRequester, url: string): Fetched => {
        const response = sendRequester.sendRequest({ url, method: "GET", cacheSettings: { store: true, maxAge: "60s" } }).result()
        if (!ok(response)) return { status: response.statusCode, body: "" }
        return { status: response.statusCode, body: JSON.stringify(json(response)) }
      },
      consensusIdenticalAggregation<Fetched>(),
    )(target)
    .result()
  return result.body ? JSON.parse(result.body) : null
}

export const decidePosture = (fearGreed: number | null, eth24hPct: number | null, config: Pick<Config, "cautionFearGreed" | "haltDropPct">) => {
  if (eth24hPct !== null && eth24hPct <= -config.haltDropPct) return { posture: "HALT_ENTRIES", reason: `ETH moved ${eth24hPct.toFixed(2)}% in 24h` }
  if (fearGreed === null || eth24hPct === null) return { posture: "CAUTION", reason: "market data unavailable" }
  if (fearGreed <= config.cautionFearGreed) return { posture: "CAUTION", reason: `fear & greed at ${fearGreed}` }
  return { posture: "NORMAL", reason: "no risk rule triggered" }
}

const onCron = (runtime: Runtime<Config>): string => {
  const config = runtime.config
  const network = getNetwork({ chainFamily: "evm", chainSelectorName: config.chainSelectorName, isTestnet: true })
  if (!network) throw new Error(`Network not found: ${config.chainSelectorName}`)
  const evm = new EVMClient(network.chainSelector.selector)

  const entries = readCount(runtime, evm, config.ledgerAddress, "totalEntries")
  const decisions = readCount(runtime, evm, config.vaultAddress, "totalDecisions")
  const skipped = readCount(runtime, evm, config.vaultAddress, "totalSkipped")
  runtime.log(`Read Mantle Sepolia: ${entries} ledger entries, ${decisions} decisions, ${skipped} skipped`)

  const fg = fetchJson(runtime, config.fearGreedUrl)
  const price = fetchJson(runtime, config.priceUrl)
  const fearGreed = fg?.data?.[0]?.value !== undefined ? Number(fg.data[0].value) : null
  const eth24hPct = typeof price?.ethereum?.usd_24h_change === "number" ? price.ethereum.usd_24h_change : null
  runtime.log(`External APIs: fear & greed ${fearGreed}, ETH 24h ${eth24hPct}`)

  const summary = {
    ledgerEntries: entries.toString(), decisions: decisions.toString(), skipped: skipped.toString(),
    fearGreed, eth24hPct, ...decidePosture(fearGreed, eth24hPct, config),
  }
  runtime.log(`Done: ${JSON.stringify(summary)}`)
  return JSON.stringify(summary)
}

const initWorkflow = (config: Config) => {
  const cron = new CronCapability()
  return [handler(cron.trigger({ schedule: config.schedule }), onCron)]
}

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema })
  await runner.run(initWorkflow)
}
