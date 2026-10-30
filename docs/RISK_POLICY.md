# Risk Policy

Enforced in risk.ts. Override with the VIGIL_RISK_POLICY JSON env var. VIGIL_KILL_SWITCH=true blocks all new entries.

| Control | Default |
|---|---|
| Starting practice equity | $100,000 |
| Max position | $5,000 |
| Max portfolio / token exposure | 30% / 10% |
| Max open positions | 5 |
| Max daily simulated loss / drawdown | 3% / 10% |
| Min liquidity | $1,000,000 |
| Max estimated slippage | 50 bps |
| Min confidence / safety score | 0.20 / 70 |
| Stop-loss / take-profit | 5% / 10% |
| Cooldown | 1 hour |
| Max data age | 900 seconds |
| Fee per side | 30 bps |

Missing safety or liquidity data blocks a trade. This pipeline has no real-money execution. The kill switch stops entries only; open practice positions keep being marked.
