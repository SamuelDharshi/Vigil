/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function MarketClock() {
  const [times, setTimes] = useState({
    nyse: 'CLOSED (15:47:00 remaining)',
    nasdaq: 'CLOSED (15:47:00 remaining)',
    lse: 'CLOSED (10:47:00 remaining)',
    tse: 'CLOSED (02:47:00 remaining)',
  });

  useEffect(() => {
    const clockInterval = setInterval(() => {
      const now = new Date();
      // Calculate remaining countdown of simulated Traditional market opens (15 hours basis)
      const secMod = (60 - now.getUTCSeconds()).toString().padStart(2, '0');
      const minMod = (59 - now.getUTCMinutes()).toString().padStart(2, '0');
      const hrBasis = (23 - now.getUTCHours()) % 24;

      setTimes({
        nyse: `CLOSED (${hrBasis.toString().padStart(2, '0')}:${minMod}:${secMod} next open)`,
        nasdaq: `CLOSED (${hrBasis.toString().padStart(2, '0')}:${minMod}:${secMod} next open)`,
        lse: `CLOSED (${((hrBasis + 5) % 24).toString().padStart(2, '0')}:${minMod}:${secMod} next open)`,
        tse: `CLOSED (${((hrBasis + 11) % 24).toString().padStart(2, '0')}:${minMod}:${secMod} next open)`,
      });
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-10 bg-[#020202]/95 border-t border-white/5 backdrop-blur-md z-40 flex items-center overflow-x-auto whitespace-nowrap scrollbar-none px-4 justify-between font-mono text-[10px] text-gray-500 uppercase tracking-widest gap-6">
      
      <div className="flex items-center gap-6 divide-x divide-white/5">
        <div className="flex items-center gap-1.5 text-gray-400">
          <span className="text-gray-500 font-bold">TRADITIONAL MARKETS</span>
        </div>
        <div className="pl-6">
          NYSE: <span className="text-red-500 font-semibold">{times.nyse}</span>
        </div>
        <div className="pl-6">
          NASDAQ: <span className="text-red-500 font-semibold">{times.nasdaq}</span>
        </div>
        <div className="pl-6">
          LSE: <span className="text-red-500 font-semibold">{times.lse}</span>
        </div>
        <div className="pl-6 font-semibold">
          TSE: <span className="text-red-500 font-semibold">{times.tse}</span>
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
