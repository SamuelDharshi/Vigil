# Vigil: RYO-CHAN Hackathon 2026, Track 01 Autonomous Agents

**Status: draft. Needs team approval, a live run and a demo video before submission.**

**Problem.** Market information is fragmented, and traders struggle to connect signals to transparent reasoning and consistent risk controls.

**Solution.** Vigil turns market evidence into structured decisions, practice trades and a tamper-evident reasoning record.

**Innovation.** Vigil preserves the whole decision chain and measures the outcome of its own hypotheses. NO_TRADE is a normal result.

**How it works.** RYO-CHAN evidence is validated and hashed, scored by deterministic rules and checked against hard risk limits. Permitted practice trades are recorded, followed and replayable. See docs/ARCHITECTURE.md.

**This is a practice-trading system and does not execute real-money trades.**

**Form fields:** team name, participant, email, Discord, GitHub username, demo video URL and X post URL are for the team to complete. Repo: https://github.com/SamuelDharshi/Vigil

**AI use:** the research pipeline and these docs were written with Claude Code.

## Team presentation

1. Agents often can't show why they acted.
2. Vigil keeps evidence, score, risk checks and outcome together.
3. Missing data stays missing, and bad data blocks trades.
4. Rules decide; there is no LLM override.
5. Any decision can be replayed, and tampering is detectable.

## Data disclosure

We requested a RYO-CHAN key but had not received one. The RYO-CHAN client is implemented but has not been tested live. The recorded live run uses public APIs: 3 decisions, all NO_TRADE, no practice trades yet. Nothing has been anchored on-chain from this pipeline.
