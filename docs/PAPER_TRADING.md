# Paper Trading

Practice only. Decision log: packages/agent/data/decisions.jsonl (git-ignored).

Each trade stores ID, token, contract, chain, direction, entry and exit price, size, times, stop, target, fees, estimated slippage, net P&L, strategy, decision and snapshot IDs, and exit reason.

Fill model: observed price adjusted by estimated slippage (size / liquidity x 5000 bps) on both sides, plus fees on both sides. Fills are modelled, not real. Stops are checked only when the agent runs, so exits use the price observed then and can be worse than the stop.

Long-only. Rejected ideas are recorded as NO_TRADE decisions. There are no cancelled orders because entries fill immediately.
