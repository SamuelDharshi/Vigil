# Testing

`cd packages/agent && npm run test:research`

Latest result (2026-10-31): 15 pass, 0 fail, using fixtures rather than live data. `npx tsc --noEmit` is clean.

Covers scenarios A to G, take-profit, malformed data, kill switch, liquidity, slippage, cooldown, unmarkable positions, tampering, duplicates and replay.

Not run: live RYO-CHAN calls, contract tests, frontend builds, test-all.ts, on-chain writes. Daily-loss, drawdown and token-exposure limits are implemented but have no dedicated test.
