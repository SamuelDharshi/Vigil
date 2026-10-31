/**
 * Research Page — practice-trading decisions, reasoning, portfolio, anchors and replay.
 * Reads the agent's real log from /decisions.jsonl. There is no sample data: with no log it says so.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Trade { tradeId: string; status: string; token: string; entryPrice: number; exitPrice?: number; sizeUsd: number; stopLoss: number; takeProfit: number; feesUsd: number; netPnlUsd?: number; exitReason?: string }
interface Decision {
  decisionId: string; timestamp: number; token: string; action: string; reason: string; hash: string; tradeId: string | null; trade: Trade | null;
  snapshot: { snapshotId: string; observedAt: string | null; ageSeconds: number | null; unavailable: string[]; rejected: string[]; sources: { tool: string; ok: boolean; error?: string }[]; observations: Record<string, unknown> };
  assessment: { bullish: string[]; bearish: string[]; conflicts: string[]; confidence: number; scores: Record<string, number | null> };
  risk: { violations: string[]; sizeUsd: number } | null;
}
interface Anchor { decisionId: string; txHash: string; block: number }

const parse = <T,>(text: string): T[] => text.split('\n').filter(Boolean).map(l => JSON.parse(l));
const load = async <T,>(url: string): Promise<T[]> => {
  const res = await fetch(url);
  const text = await res.text();
  return res.ok && !text.trimStart().startsWith('<') ? parse<T>(text) : [];
};

const List = ({ title, items }: { title: string; items: string[] }) => (
  <div style={{ marginBottom: 14 }}>
    <h3 style={{ fontSize: 13, opacity: 0.7, margin: '0 0 4px' }}>{title}</h3>
    {items.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{items.map(i => <li key={i}>{i}</li>)}</ul> : <p style={{ margin: 0, opacity: 0.6 }}>None</p>}
  </div>
);

export default function ResearchPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<Decision[] | null>(null);
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    load<Decision>('/decisions.jsonl').then(setRecords).catch(() => setRecords([]));
    load<Anchor>('/anchors.jsonl').then(setAnchors).catch(() => setAnchors([]));
  }, []);

  const current = records?.find(r => r.decisionId === selected) ?? records?.at(-1) ?? null;
  const outcome = current?.tradeId ? records?.filter(r => r.tradeId === current.tradeId && r.trade?.status === 'CLOSED').at(-1)?.trade : null;
  const anchor = anchors.find(a => a.decisionId === current?.decisionId);

  const trades = useMemo(() => {
    const byId = new Map<string, Trade>();
    records?.forEach(r => { if (r.trade) byId.set(r.trade.tradeId, r.trade); });
    return [...byId.values()];
  }, [records]);
  const pnl = trades.reduce((t, x) => t + (x.netPnlUsd ?? 0), 0);

  return (
    <main style={{ minHeight: '100vh', background: '#0b0f0e', color: '#e8ecea', padding: '24px clamp(16px, 4vw, 48px)', fontFamily: 'system-ui, sans-serif', fontSize: 14 }}>
      <button onClick={() => navigate('/')} style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: 0 }}>← Back</button>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Agent research</h1>
      <p style={{ opacity: 0.7, marginTop: 0 }}>Practice trades only. No real funds. P&amp;L is simulated.</p>

      {records === null && <p>Loading decision log…</p>}
      {records?.length === 0 && <p>No decisions recorded yet. Run the agent and publish its log to see real results here.</p>}

      {!!records?.length && current && (
        <>
          <p>{records.length} decisions · {trades.length} practice trades · net simulated P&amp;L ${pnl.toFixed(2)} · {anchors.length} anchored on Mantle Sepolia</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            <section>
              <h2 style={{ fontSize: 16 }}>Decisions</h2>
              {[...records].reverse().map(r => (
                <button key={r.decisionId} onClick={() => setSelected(r.decisionId)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 8, marginBottom: 4, cursor: 'pointer', color: 'inherit', border: '1px solid #26302c', background: r === current ? '#1a2320' : 'transparent' }}>
                  {new Date(r.timestamp).toISOString().slice(0, 16)} · {r.token} · <strong>{r.action}</strong>
                </button>
              ))}
            </section>
            <section>
              <h2 style={{ fontSize: 16 }}>Replay: {current.token} {current.action}</h2>
              <p>{current.reason}</p>
              <p>Confidence {current.assessment.confidence} · overall {current.assessment.scores.overall}</p>
              <List title="Bullish evidence" items={current.assessment.bullish} />
              <List title="Bearish evidence" items={current.assessment.bearish} />
              <List title="Conflicts" items={current.assessment.conflicts} />
              <List title="Unavailable evidence" items={current.snapshot.unavailable} />
              <List title="Risk violations" items={current.risk?.violations ?? []} />
              <List title="Sources" items={current.snapshot.sources.map(s => `${s.tool}: ${s.ok ? 'ok' : s.error}`)} />
              <h3 style={{ fontSize: 13, opacity: 0.7, margin: '0 0 4px' }}>Outcome</h3>
              <p>{outcome ? `${outcome.exitReason}: net $${(outcome.netPnlUsd ?? 0).toFixed(2)}, thesis ${(outcome.netPnlUsd ?? 0) > 0 ? 'supported' : 'contradicted'}` : 'No closed outcome'}</p>
              <h3 style={{ fontSize: 13, opacity: 0.7, margin: '0 0 4px' }}>Record</h3>
              <p style={{ wordBreak: 'break-all' }}>Hash {current.hash}</p>
              <p>{anchor
                ? <a style={{ color: '#7fd8b0' }} href={`https://sepolia.mantlescan.xyz/tx/${anchor.txHash}`} target="_blank" rel="noreferrer">Anchored in block {anchor.block}</a>
                : 'Not anchored on-chain'}</p>
            </section>
          </div>
          <section style={{ overflowX: 'auto' }}>
            <h2 style={{ fontSize: 16 }}>Paper portfolio</h2>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr style={{ textAlign: 'left' }}>{['Token', 'Status', 'Size', 'Entry', 'Exit', 'Stop', 'Target', 'Fees', 'Net P&L', 'Exit reason'].map(h => <th key={h} style={{ padding: 6 }}>{h}</th>)}</tr></thead>
              <tbody>{trades.map(t => (
                <tr key={t.tradeId}>
                  {[t.token, t.status, `$${t.sizeUsd}`, t.entryPrice.toFixed(4), t.exitPrice?.toFixed(4) ?? '–', t.stopLoss.toFixed(4), t.takeProfit.toFixed(4), `$${t.feesUsd.toFixed(2)}`, t.netPnlUsd === undefined ? '–' : `$${t.netPnlUsd.toFixed(2)}`, t.exitReason ?? '–'].map((c, i) => <td key={i} style={{ padding: 6 }}>{c}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
