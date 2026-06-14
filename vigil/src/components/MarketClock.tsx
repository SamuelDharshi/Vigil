import React, { useEffect, useState } from 'react';

// Check if a market is open based on actual timezones
const isMarketOpen = (market: 'NYSE' | 'NASDAQ' | 'LSE' | 'TSE', now: Date) => {
  const getNYC = (d: Date) => {
    const yr = d.getUTCFullYear();
    const dstStart = new Date(Date.UTC(yr, 2, 8 - (new Date(Date.UTC(yr, 2, 1)).getUTCDay() + 6) % 7 + (new Date(Date.UTC(yr, 2, 1)).getUTCDay() === 0 ? 7 : 0), 7));
    const dstEnd   = new Date(Date.UTC(yr, 10, 1 + (7 - new Date(Date.UTC(yr, 10, 1)).getUTCDay()) % 7, 6));
    const offset = d >= dstStart && d < dstEnd ? 4 : 5;
    return new Date(d.getTime() - offset * 3_600_000);
  };

  const getLondon = (d: Date) => {
    const yr = d.getUTCFullYear();
    const dstStart = new Date(Date.UTC(yr, 2, 31 - (new Date(Date.UTC(yr, 2, 31)).getUTCDay()), 1));
    const dstEnd = new Date(Date.UTC(yr, 9, 31 - (new Date(Date.UTC(yr, 9, 31)).getUTCDay()), 1));
    const offset = d >= dstStart && d < dstEnd ? -1 : 0;
    return new Date(d.getTime() - offset * 3_600_000);
  };

  const getTokyo = (d: Date) => {
    return new Date(d.getTime() + 9 * 3_600_000);
  };

  let mktTime: Date;
  let startHour = 9, startMin = 0;
  let endHour = 15, endMin = 0;

  if (market === 'NYSE' || market === 'NASDAQ') {
    mktTime = getNYC(now);
    startHour = 9; startMin = 30;
    endHour = 16; endMin = 0;
  } else if (market === 'LSE') {
    mktTime = getLondon(now);
    startHour = 8; startMin = 0;
    endHour = 16; endMin = 30;
  } else {
    mktTime = getTokyo(now);
    startHour = 9; startMin = 0;
    endHour = 15; endMin = 0;
  }

  const day = mktTime.getUTCDay();
  const isWeekday = day >= 1 && day <= 5;
  if (!isWeekday) return false;

  const hr = mktTime.getUTCHours();
  const min = mktTime.getUTCMinutes();
  const currentMinutes = hr * 60 + min;
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
};

export default function MarketClock() {
  const [forceOpen, setForceOpen] = useState(() => {
    try {
      const stored = localStorage.getItem('vigil_demo_force_open');
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });

  const [times, setTimes] = useState({
    nyse: 'CLOSED (15:47:00 remaining)',
    nasdaq: 'CLOSED (15:47:00 remaining)',
    lse: 'CLOSED (10:47:00 remaining)',
    tse: 'CLOSED (02:47:00 remaining)',
  });

  const [openStatus, setOpenStatus] = useState({
    nyse: false,
    nasdaq: false,
    lse: false,
    tse: false,
  });

  const toggleDemoMode = () => {
    const nextVal = !forceOpen;
    setForceOpen(nextVal);
    try {
      localStorage.setItem('vigil_demo_force_open', String(nextVal));
    } catch {}
  };

  useEffect(() => {
    const clockInterval = setInterval(() => {
      const now = new Date();
      
      const secMod = (60 - now.getUTCSeconds()).toString().padStart(2, '0');
      const minMod = (59 - now.getUTCMinutes()).toString().padStart(2, '0');
      const hrBasis = (23 - now.getUTCHours()) % 24;

      setTimes({
        nyse: `${hrBasis.toString().padStart(2, '0')}:${minMod}:${secMod} next open`,
        nasdaq: `${hrBasis.toString().padStart(2, '0')}:${minMod}:${secMod} next open`,
        lse: `${((hrBasis + 5) % 24).toString().padStart(2, '0')}:${minMod}:${secMod} next open`,
        tse: `${((hrBasis + 11) % 24).toString().padStart(2, '0')}:${minMod}:${secMod} next open`,
      });

      setOpenStatus({
        nyse: isMarketOpen('NYSE', now),
        nasdaq: isMarketOpen('NASDAQ', now),
        lse: isMarketOpen('LSE', now),
        tse: isMarketOpen('TSE', now),
      });
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  const getMarketText = (mkt: 'nyse' | 'nasdaq' | 'lse' | 'tse') => {
    const isOpen = forceOpen || openStatus[mkt];
    if (isOpen) {
      return <span className="text-[#00FF7F] font-bold">OPEN</span>;
    }
    return <span className="text-red-500 font-semibold">CLOSED ({times[mkt]})</span>;
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-10 bg-[#020202]/95 border-t border-white/5 backdrop-blur-md z-40 flex items-center overflow-x-auto whitespace-nowrap scrollbar-none px-4 justify-between font-mono text-[10px] text-gray-500 uppercase tracking-widest gap-6">
      
      <div className="flex items-center gap-6 divide-x divide-white/5">
        <div 
          onClick={toggleDemoMode}
          className="flex items-center gap-2 text-gray-400 hover:text-[#00FF7F] transition-colors cursor-pointer select-none"
          title="Click to toggle Demo Mode (Force All Open / Auto)"
        >
          <span className="font-bold">TRADITIONAL MARKETS</span>
          {forceOpen && (
            <span className="text-[8px] bg-[#00FF7F]/10 text-[#00FF7F] border border-[#00FF7F]/20 px-1.5 py-0.5 rounded-xs font-mono font-bold tracking-normal normal-case">
              DEMO FORCE
            </span>
          )}
        </div>
        <div className="pl-6">
          NYSE: {getMarketText('nyse')}
        </div>
        <div className="pl-6">
          NASDAQ: {getMarketText('nasdaq')}
        </div>
        <div className="pl-6">
          LSE: {getMarketText('lse')}
        </div>
        <div className="pl-6 font-semibold">
          TSE: {getMarketText('tse')}
        </div>
      </div>

      <div className="flex items-center gap-2 text-right">
        <span className="text-gray-500">VIGIL PIPELINE:</span>
        <span className="flex items-center gap-1.5 text-[#00FF7F] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00FF7F] animate-ping" />
          ACTIVE ●
        </span>
      </div>

    </footer>
  );
}
