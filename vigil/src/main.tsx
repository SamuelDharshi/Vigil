/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import WarRoomPage from './pages/WarRoomPage';
import ChartsPage from './pages/ChartsPage';
import ProofPage from './pages/ProofPage';
import ThreePage from './pages/ThreePage';
import ResearchPage from './pages/ResearchPage';
import './index.css';

const demo = (page: React.ReactNode) => (
  <>
    <div role="note" style={{ background: '#7a4a00', color: '#fff', padding: '8px 16px', fontSize: 13, textAlign: 'center' }}>
      Simulated demo data, not agent activity. Real practice decisions are on the <a href="/research" style={{ color: 'inherit' }}>Research page</a>.
    </div>
    {page}
  </>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/warroom" element={demo(<WarRoomPage />)} />
        <Route path="/charts" element={demo(<ChartsPage />)} />
        <Route path="/proof" element={demo(<ProofPage />)} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/3d" element={<ThreePage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
