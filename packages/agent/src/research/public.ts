import axios from "axios";
import { Caller, MarketOverview, TokenAnalysis, ToolName, ToolResult } from "./ryochan";

/**
 * Keyless fallback used only when RYOCHAN_API_KEY is absent. Every value comes from a live
 * public API: CoinGecko (price, volume, history), DexScreener (liquidity), GoPlus (contract
 * checks), Alternative.me (fear & greed). Failed sources stay missing. Trend, RSI and the
 * safety score are computed here, and each snapshot's source records that.
 */
export const PUBLIC_TOKENS: Record<string, { id: string; contract: string }> = {
  LINK: { id: "chainlink", contract: "0x514910771af9ca656af840dff83e8264ecf986ca" },
  UNI: { id: "uniswap", contract: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984" },
  AAVE: { id: "aave", contract: "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9" },
};

const get = async (url: string) => (await axios.get(url, { timeout: 15_000 })).data;

export function rsi14(closes: number[]): number | null {
  if (closes.length < 15) return null;
  let gain = 0, loss = 0;
  for (const [i, c] of closes.slice(-14).entries()) {
    const d = c - closes[closes.length - 15 + i];
    if (d > 0) gain += d; else loss -= d;
  }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

async function analyze(symbol: string): Promise<TokenAnalysis> {
  const t = PUBLIC_TOKENS[symbol.toUpperCase()];
  if (!t) throw new Error(`unsupported token ${symbol}`);
  const [market] = await get(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${t.id}`);
  const chart = await get(`https://api.coingecko.com/api/v3/coins/${t.id}/market_chart?vs_currency=usd&days=31&interval=daily`);
  const closes: number[] = chart.prices.map((p: number[]) => p[1]);
  const momentum = (closes.at(-1)! / closes[0] - 1) * 100;
  const sma = (n: number) => closes.slice(-n).reduce((a, b) => a + b, 0) / n;

  const dex = await get(`https://api.dexscreener.com/latest/dex/tokens/${t.contract}`).catch(() => null);
  const liquidity = (dex?.pairs ?? []).filter((p: any) => p.chainId === "ethereum")
    .reduce((m: number, p: any) => Math.max(m, p.liquidity?.usd ?? 0), 0);

  const gp = await get(`https://api.gopluslabs.io/api/v1/token_security/1?contract_addresses=${t.contract}`).catch(() => null);
  const sec = gp?.result?.[t.contract];
  const bad = sec ? ["is_honeypot", "is_blacklisted", "cannot_sell_all", "selfdestruct", "hidden_owner"].filter(k => sec[k] === "1") : [];

  return {
    symbol: symbol.toUpperCase(), contract: t.contract, chain: "ethereum", price_usd: String(market.current_price),
    changes: { h24: market.price_change_percentage_24h },
    market: { volume_24h_usd: String(market.total_volume), liquidity_usd: liquidity ? String(liquidity) : null },
    technicals: { trend: sma(7) > sma(21) ? "uptrend" : "downtrend", rsi_14: rsi14(closes), momentum_30d_pct: momentum },
    intelligence: { narrative: "" },
    safety: sec
      ? { score: 100 - bad.length * 40, safe: bad.length === 0, honeypot: sec.is_honeypot === "1", flags: bad }
      : { score: null, safe: null, honeypot: null, unavailable_reason: "GoPlus unavailable" },
    generated_at: market.last_updated,
  };
}

async function overview(): Promise<MarketOverview> {
  const fg = (await get("https://api.alternative.me/fng/?limit=1")).data[0];
  return { regime: null, fear_greed: { value: Number(fg.value), label: fg.value_classification }, generated_at: new Date().toISOString() };
}

export const publicCall: Caller = async <T>(tool: ToolName, args: Record<string, unknown>): Promise<ToolResult<T>> => {
  const source = "public:coingecko+dexscreener+goplus+alternative.me";
  const fetchedAt = Date.now();
  try {
    const data = tool === "analyze_token" ? await analyze(String(args.symbol)) : tool === "market_overview" ? await overview() : null;
    if (!data) throw new Error(`${tool} has no public source`);
    return { ok: true, tool, source, fetchedAt, data: data as T };
  } catch (err: any) {
    return { ok: false, tool, source, fetchedAt, error: err.message, rateLimited: err.response?.status === 429 };
  }
};
