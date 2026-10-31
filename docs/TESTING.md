# Testing

`cd packages/agent && npm run test:research`

Latest agent result (2026-10-31): 19 pass, 0 fail, using fixtures rather than live data.

Covers scenarios A to G, take-profit, malformed data, kill switch, liquidity, slippage, cooldown, daily loss, drawdown, token exposure, token selection, unmarkable positions, tampering, duplicates and replay.

Contract tests: 42 pass, 0 fail (hardhat). Frontend: vite build succeeds. Not run: live RYO-CHAN calls, test-all.ts, on-chain writes.
