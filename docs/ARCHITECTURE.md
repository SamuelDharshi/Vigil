# Architecture

The practice-trading pipeline lives in packages/agent/src/research/.

| Stage | File | Job |
|---|---|---|
| Market intelligence | ryochan.ts | Calls RYO-CHAN analyze_token and market_overview over REST. Failures are returned, not hidden. |
| Evidence validation | evidence.ts | Checks schema, symbol, price and age; records unavailable fields; hashes the snapshot. |
| Reasoning | strategy.ts | Deterministic scoring, bullish and bearish lists, conflict detection. |
| Risk | risk.ts | Hard limits and kill switch. |
| Paper trading | paper.ts | Opens and closes simulated positions with fees and estimated slippage. |
| Record and replay | agent.ts | Hash-chained decision log, derived portfolio, metrics, replay. |

No LLM takes part in this pipeline. The older Mantle loop (cron.ts) is separate and still runs on testnet mock tokens.

Dashboard: the /research route shows real decisions, reasoning, portfolio, anchors and replay from vigil/public/decisions.jsonl and anchors.jsonl. War Room, Charts and Proof are simulated demo pages and are labelled so.

Run it: set RYOCHAN_API_KEY, then `cd packages/agent && npm run research:run`.
