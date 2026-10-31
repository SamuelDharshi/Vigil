# Data Provenance

Each snapshot stores tool, URL, fetch time, provider timestamp, token, contract, chain, age, raw response, unavailable fields and rejection reasons.

Verified from the public OpenAPI spec: POST https://app-ryochan.com/api/mcp/tools/{tool_name}/call with a Bearer ryo_mcp_ key, plus the TokenAnalysis and MarketOverview schemas.

**Not verified:** no live tool call has been made, because no key is available. The argument name (symbol) and the REST response shape are assumptions until tested. /api/mcp/health reported 6 tools while the site lists 7.

Removed from signals/nansen.ts: a fixed $85k "whale flow" built from our own vault activity, a time-of-day signal, a market-wide signal split across assets, and hardcoded fallback prices.

Elfa engagement is no longer scored as sentiment, and the gas loop now labels minted mock mETH as simulated. Still weak: Nansen flows use proxy tokens, the ZK input uses a hardcoded target allocation, and the War Room frontend is simulated.

## Keyless live mode

No RYO-CHAN key was issued in time for this run, so without RYOCHAN_API_KEY the agent uses public APIs (research/public.ts): CoinGecko, DexScreener, GoPlus and Alternative.me. Trend, RSI and the safety score are computed locally. First live run, 2026-10-31: 3 decisions, all NO_TRADE, one caused by a CoinGecko 429 recorded as missing evidence. See docs/evidence/public-run-2026-10-31.jsonl.
