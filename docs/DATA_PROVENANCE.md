# Data Provenance

Each snapshot stores tool, URL, fetch time, provider timestamp, token, contract, chain, age, raw response, unavailable fields and rejection reasons.

Verified from the public OpenAPI spec: POST https://app-ryochan.com/api/mcp/tools/{tool_name}/call with a Bearer ryo_mcp_ key, plus the TokenAnalysis and MarketOverview schemas.

**Not verified:** no live tool call has been made, because no key is available. The argument name (symbol) and the REST response shape are assumptions until tested. /api/mcp/health reported 6 tools while the site lists 7.

Removed from signals/nansen.ts: a fixed $85k "whale flow" built from our own vault activity, a time-of-day signal, a market-wide signal split across assets, and hardcoded fallback prices.

Still weak in the older loop: elfa.ts treats engagement as sentiment and sets its baseline to 0, Nansen flows use proxy tokens, and the gas loop mints mock mETH and calls it yield.
