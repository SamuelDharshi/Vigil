-- VIGIL Postgres Schema
-- Run: psql vigil < migrations/001_init.sql

CREATE DATABASE vigil;
\c vigil;

-- ──────────────────────────────────────────────────────────────────────────────
-- DECISIONS — Every decision VIGIL has ever made
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decisions (
    id                  UUID PRIMARY KEY,
    timestamp_ms        BIGINT NOT NULL,
    action              VARCHAR(30) NOT NULL,      -- ROTATE | CLMM_OPEN | SKIP | etc.
    from_asset          VARCHAR(20),
    from_token          VARCHAR(42),               -- EVM address
    to_asset            VARCHAR(20),
    to_token            VARCHAR(42),               -- EVM address
    amount_usd_6dp      BIGINT,                    -- USD amount, 6 decimals
    confidence          NUMERIC(5,4),              -- 0.0000 – 1.0000
    reasoning           TEXT,                      -- Human-readable, Instrument Serif in UI
    signal_bundle_id    UUID,
    signal_bundle_cid   VARCHAR(100),              -- IPFS CID
    skip_reason         VARCHAR(50),               -- CONFIDENCE_TOO_LOW | GAS_LOW | etc.
    zk_proof_hash       VARCHAR(66),               -- bytes32 hex
    tx_hash             VARCHAR(66),               -- On-chain execution hash
    slippage_bps        INTEGER,
    erc8004_task_id     VARCHAR(66),
    ledger_entry_id     INTEGER,
    outcome_6h          NUMERIC(10,4),             -- % price delta 6h later
    outcome_24h         NUMERIC(10,4),
    public_proof_url    TEXT,
    share_text          TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_timestamp ON decisions(timestamp_ms DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_action ON decisions(action);
CREATE INDEX IF NOT EXISTS idx_decisions_tx_hash ON decisions(tx_hash);

-- ──────────────────────────────────────────────────────────────────────────────
-- LEDGER_ENTRIES — Mirror of VIGILLedger.sol on-chain events
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ledger_entries (
    entry_id            INTEGER PRIMARY KEY,       -- VIGILLedger entry index
    agent_id            BIGINT NOT NULL,            -- ERC-8004 token ID
    entry_type          SMALLINT NOT NULL,          -- 0=SKIP 1=EXECUTE 2=CROSS_CHAIN 3=CLMM
    from_token          VARCHAR(42),
    to_token            VARCHAR(42),
    amount              BIGINT,
    confidence          BIGINT,                    -- × 10000
    slippage_bps        BIGINT,
    tx_hash             VARCHAR(66),
    zk_proof_hash       VARCHAR(66),
    signal_bundle_hash  VARCHAR(66),
    skip_reason         TEXT,
    reasoning           TEXT,
    block_number        BIGINT,
    block_timestamp     BIGINT,
    log_timestamp       BIGINT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_timestamp ON ledger_entries(block_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_entry_type ON ledger_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_ledger_tx_hash ON ledger_entries(tx_hash);
CREATE INDEX IF NOT EXISTS idx_ledger_zk_hash ON ledger_entries(zk_proof_hash);

-- ──────────────────────────────────────────────────────────────────────────────
-- SIGNAL_BUNDLES — Snapshot of signal data for each decision cycle
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signal_bundles (
    id                  UUID PRIMARY KEY,
    timestamp_ms        BIGINT NOT NULL,
    ipfs_cid            VARCHAR(100),
    meth_apr            NUMERIC(6,2),
    usdy_yield          NUMERIC(6,2),
    nvdax_price         NUMERIC(12,2),
    aaplx_price         NUMERIC(12,2),
    tslax_price         NUMERIC(12,2),
    mnt_price_usd       NUMERIC(10,4),
    smart_money_flows   JSONB,                     -- NansenBundle
    sentiment_deltas    JSONB,                     -- ElfaBundle
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- AGENT_STATE — Current agent status for War Room UI
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_state (
    id                  INTEGER PRIMARY KEY DEFAULT 1,  -- singleton
    agent_id            BIGINT,
    agent_wallet        VARCHAR(42),
    reputation_score    NUMERIC(6,1) DEFAULT 0,
    total_decisions     INTEGER DEFAULT 0,
    total_executed      INTEGER DEFAULT 0,
    total_skipped       INTEGER DEFAULT 0,
    uptime_started_at   BIGINT,
    active_clmm_pos     VARCHAR(100),              -- Byreal position ID if open
    gas_reservoir_mnt   NUMERIC(18,4) DEFAULT 0,
    last_cycle_at       BIGINT,
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial singleton row
INSERT INTO agent_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────────
-- Useful views for the frontend API
-- ──────────────────────────────────────────────────────────────────────────────

-- Recent executed decisions for the Action Ledger
CREATE OR REPLACE VIEW recent_executions AS
SELECT
    d.*,
    le.block_number,
    le.block_timestamp
FROM decisions d
LEFT JOIN ledger_entries le ON d.tx_hash = le.tx_hash
WHERE d.action != 'SKIP'
ORDER BY d.timestamp_ms DESC
LIMIT 50;

-- Agent accuracy (% of executed decisions with positive outcome at 6h)
CREATE OR REPLACE VIEW agent_accuracy AS
SELECT
    COUNT(*) FILTER (WHERE action != 'SKIP') as total_executed,
    COUNT(*) FILTER (WHERE outcome_6h > 0) as positive_outcomes,
    CASE
        WHEN COUNT(*) FILTER (WHERE action != 'SKIP' AND outcome_6h IS NOT NULL) > 0
        THEN ROUND(
            100.0 * COUNT(*) FILTER (WHERE outcome_6h > 0) /
            NULLIF(COUNT(*) FILTER (WHERE action != 'SKIP' AND outcome_6h IS NOT NULL), 0),
            1
        )
        ELSE NULL
    END as accuracy_pct
FROM decisions;
