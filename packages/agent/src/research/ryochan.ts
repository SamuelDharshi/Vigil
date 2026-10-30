import axios from "axios";

/**
 * RYO-CHAN research client.
 * Contract taken from https://app-ryochan.com/api/openapi.json:
 *   POST /api/mcp/tools/{tool_name}/call  (REST equivalent of MCP tools/call)
 *   Header: Authorization: Bearer ryo_mcp_...
 *
 * A failed call returns { ok: false } with the reason. It never returns placeholder data.
 */

const BASE_URL = process.env.RYOCHAN_BASE_URL || "https://app-ryochan.com";

export type ToolName =
  | "market_overview" | "scan_market" | "analyze_token" | "deep_analysis"
  | "compare_tokens" | "check_safety" | "supported_tokens";

export type ToolResult<T> =
  | { ok: true; tool: ToolName; source: string; fetchedAt: number; data: T }
  | { ok: false; tool: ToolName; source: string; fetchedAt: number; error: string; rateLimited: boolean };

export type Caller = <T>(tool: ToolName, args: Record<string, unknown>) => Promise<ToolResult<T>>;

export const callTool: Caller = async <T>(tool: ToolName, args: Record<string, unknown>) => {
  const source = `${BASE_URL}/api/mcp/tools/${tool}/call`;
  const fetchedAt = Date.now();
  const key = process.env.RYOCHAN_API_KEY;
  if (!key) return { ok: false, tool, source, fetchedAt, error: "RYOCHAN_API_KEY not set", rateLimited: false };

  try {
    const res = await axios.post(source, args, {
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      timeout: 20_000,
    });
    return { ok: true, tool, source, fetchedAt, data: res.data as T };
  } catch (err: any) {
    const status = err.response?.status;
    const message = err.response?.data?.message || err.message;
    return { ok: false, tool, source, fetchedAt, error: `${status ?? "network"}: ${message}`, rateLimited: status === 429 };
  }
};

// Field names mirror the TokenAnalysis schema. Decimal values arrive as strings.
export interface TokenAnalysis {
  symbol: string;
  contract: string;
  chain?: unknown;
  verdict?: string | null;
  price_usd: string;
  changes?: { h1?: number | null; h24?: number | null; d7?: number | null; d30?: number | null } | null;
  market: { volume_24h_usd?: string | null; liquidity_usd?: string | null; mcap_usd?: string | null };
  technicals: { trend?: string | null; rsi_14?: number | null; momentum_30d_pct?: number | null; atr_14_pct?: number | null };
  intelligence: { narrative: string; catalysts?: unknown[]; risks?: unknown[] };
  safety: { score?: number | null; safe?: boolean | null; honeypot?: boolean | null; flags?: unknown[]; unavailable_reason?: string | null };
  generated_at: string;
}

export interface MarketOverview {
  regime?: string | null;
  fear_greed?: { value: number; label: string } | null;
  generated_at: string;
}
