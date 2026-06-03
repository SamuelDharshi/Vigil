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
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/warroom" element={<WarRoomPage />} />
        <Route path="/charts" element={<ChartsPage />} />
        <Route path="/proof" element={<ProofPage />} />
        <Route path="/3d" element={<ThreePage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
