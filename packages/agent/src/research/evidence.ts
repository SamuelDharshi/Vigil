import { createHash } from "crypto";
import { MarketOverview, TokenAnalysis, ToolResult } from "./ryochan";

/** Validated observations for one token. A null field means unavailable, never estimated. */
export interface EvidenceSnapshot {
  snapshotId: string;       // sha256 of the canonical content below
  token: string;
  contract: string | null;
  chain: string | null;
  observedAt: string | null;
  collectedAt: number;
  ageSeconds: number | null;
  sources: { tool: string; source: string; fetchedAt: number; ok: boolean; error?: string; rateLimited?: boolean }[];
  unavailable: string[];    // every missing field or failed source
  rejected: string[];       // reasons the snapshot cannot support a trade
  observations: {
    priceUsd: number | null;
    change24hPct: number | null;
    volume24hUsd: number | null;
    liquidityUsd: number | null;
    trend: string | null;
    rsi14: number | null;
    momentum30dPct: number | null;
    atr14Pct: number | null;
    safetyScore: number | null;
    safe: boolean | null;
    honeypot: boolean | null;
    fearGreed: number | null;
    regime: string | null;
  };
  interpretations: { narrative: string | null; verdict: string | null }; // provider opinion, not scored
  raw: unknown;
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Deterministic JSON: object keys sorted, so a replay recomputes the same hash. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function buildSnapshot(
  token: string,
  analysis: ToolResult<TokenAnalysis>,
  overview: ToolResult<MarketOverview>,
  maxAgeSeconds: number,
  now = Date.now()
): EvidenceSnapshot {
  const describe = (r: ToolResult<unknown>) => ({
    tool: r.tool, source: r.source, fetchedAt: r.fetchedAt, ok: r.ok,
    ...(r.ok ? {} : { error: r.error, rateLimited: r.rateLimited }),
  });
  const a = analysis.ok ? analysis.data : null;
  const o = overview.ok ? overview.data : null;
  const unavailable: string[] = [];
  const rejected: string[] = [];

  if (!analysis.ok) rejected.push(`analyze_token failed: ${analysis.error}`);
  if (!overview.ok) unavailable.push(`market_overview: ${overview.error}`);
  if (a && (a.symbol?.toUpperCase() !== token.toUpperCase() || !a.generated_at || !a.market || !a.technicals || !a.safety)) {
    rejected.push("analyze_token response failed schema validation");
  }
  const valid = a && rejected.length === 0 ? a : null;

  const observedMs = valid ? Date.parse(valid.generated_at) : NaN;
  const ageSeconds = Number.isNaN(observedMs) ? null : Math.floor((now - observedMs) / 1000);
  if (valid && ageSeconds === null) rejected.push("generated_at is not a valid timestamp");
  if (ageSeconds !== null && ageSeconds > maxAgeSeconds) rejected.push(`stale data: ${ageSeconds}s old, limit ${maxAgeSeconds}s`);
  if (ageSeconds !== null && ageSeconds < -60) rejected.push("generated_at is in the future");

  const observations: EvidenceSnapshot["observations"] = {
    priceUsd: num(valid?.price_usd),
    change24hPct: num(valid?.changes?.h24),
    volume24hUsd: num(valid?.market.volume_24h_usd),
    liquidityUsd: num(valid?.market.liquidity_usd),
    trend: valid?.technicals.trend ?? null,
    rsi14: num(valid?.technicals.rsi_14),
    momentum30dPct: num(valid?.technicals.momentum_30d_pct),
    atr14Pct: num(valid?.technicals.atr_14_pct),
    safetyScore: num(valid?.safety.score),
    safe: valid?.safety.safe ?? null,
    honeypot: valid?.safety.honeypot ?? null,
    fearGreed: num(o?.fear_greed?.value),
    regime: o?.regime ?? null,
  };
  for (const [k, v] of Object.entries(observations)) if (v === null) unavailable.push(k);
  if (valid?.safety.unavailable_reason) unavailable.push(`safety: ${valid.safety.unavailable_reason}`);
  if (valid && (observations.priceUsd === null || observations.priceUsd <= 0)) rejected.push("no valid price");

  const body = {
    token, contract: valid?.contract ?? null, chain: valid?.chain ? canonical(valid.chain) : null,
    observedAt: valid?.generated_at ?? null, collectedAt: now, ageSeconds,
    sources: [describe(analysis), describe(overview)], unavailable, rejected, observations,
    interpretations: { narrative: valid?.intelligence?.narrative ?? null, verdict: valid?.verdict ?? null },
    raw: { analysis: a, overview: o },
  };
  return { snapshotId: sha256(canonical(body)), ...body };
}
