/**
 * Charts Page — VIGIL TradingView Full-Screen Charts
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const CHARTS = [
  { symbol: 'CRYPTOCAP:MNT',  label: 'MNT/USD',        color: '#00FF7F', id: 'tv-mnt'  },
  { symbol: 'CRYPTO:ETHUSD',  label: 'ETH/USD',         color: '#00f0ff', id: 'tv-eth'  },
  { symbol: 'NASDAQ:NVDA',    label: 'NVDAx (NVIDIA)',  color: '#d000ff', id: 'tv-nvda' },
  { symbol: 'NASDAQ:AAPL',    label: 'AAPLx (Apple)',   color: '#f59e0b', id: 'tv-aapl' },
];

const HEADER_H = 44; // px

function TVWidget({ symbol, containerId }: { symbol: string; containerId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.id = containerId;
    widgetDiv.style.width = '100%';
    widgetDiv.style.height = '100%';
    el.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (!(window as any).TradingView) return;
      new (window as any).TradingView.widget({
        container_id: containerId,
        autosize: true,
        symbol,
        interval: 'D',
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        toolbar_bg: '#0a0a0a',
        enable_publishing: false,
        allow_symbol_change: true,
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: false,
        backgroundColor: 'rgba(2,2,2,1)',
        gridColor: 'rgba(255,255,255,0.03)',
        withdateranges: true,
        hide_side_toolbar: false,
        details: false,
        hotlist: false,
        calendar: false,
      });
    };
    el.appendChild(script);

    return () => { if (el) el.innerHTML = ''; };
  }, [symbol, containerId]);

  return <div ref={containerRef} className="w-full h-full" />;
}

export default function ChartsPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState(CHARTS[0]);

  return (
    <div
      className="flex flex-col bg-[#020202] text-white"
      style={{ height: '100vh', overflow: 'hidden' }}
    >
      {/* Slim header */}
      <header
        className="shrink-0 flex items-center justify-between px-4 border-b border-white/5 bg-[#0a0a0a]"
        style={{ height: HEADER_H }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-gray-500 hover:text-white transition-colors text-xs font-mono cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="w-px h-4 bg-white/10" />
          <span className="font-black tracking-tighter text-sm">
            VIGIL <span className="text-[#00FF7F]">Charts</span>
          </span>
        </div>

        {/* Symbol tabs */}
        <div className="flex items-center gap-0.5">
          {CHARTS.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c)}
              className="px-3 py-1.5 text-[11px] font-mono rounded-sm transition-all cursor-pointer"
              style={
                active.id === c.id
                  ? { color: c.color, background: `${c.color}14`, border: `1px solid ${c.color}35` }
                  : { color: '#4b5563', border: '1px solid transparent' }
              }
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-600">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00FF7F] animate-pulse" />
          TradingView
        </div>
      </header>

      {/* Chart fills everything below header */}
      <div className="flex-1 min-h-0">
        <TVWidget key={active.id} symbol={active.symbol} containerId={active.id} />
      </div>
    </div>
  );
}
