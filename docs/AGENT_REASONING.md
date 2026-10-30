# Agent Reasoning

Strategy: momentum-confirmation-v1. Each factor scores -1 to 1, or null if its data is missing.

| Factor | Weight | Input |
|---|---|---|
| Technical | 0.35 | Trend, damped when RSI is 75 or higher |
| Momentum | 0.30 | 30-day momentum |
| Volume | 0.20 | 24h direction times volume/liquidity turnover |
| Sentiment | 0.15 | Fear & Greed |

Confidence is the positive overall score times the share of weight present, halved if signals conflict. A long signal needs a positive overall score, a positive technical score and no conflicts.

Decisions: BUY (practice), EXIT, HOLD, NO_TRADE. Provider narrative and verdict are stored as interpretations and are not scored. The weights are unvalidated design choices, not fitted results.
