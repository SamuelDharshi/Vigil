# RYO-CHAN Changelog

Branch ryo-chan-hackathon.

- Added packages/agent/src/research/: RYO-CHAN client, evidence validation, strategy, risk, paper trading, decision log, replay, metrics and tests.
- Removed fabricated signals and hardcoded prices from signals/nansen.ts.
- Fixed a broken import in test-all.ts.
- Added the competition docs.
- Added VIGILReasoningAnchor, its tests, a deploy script and the anchor client (not deployed).
- Added scan_market token selection and more risk tests.
- Added the /research dashboard; labelled simulated pages and removed random proofs.
- Stopped treating Elfa engagement as sentiment; labelled simulated gas-loop yield.
