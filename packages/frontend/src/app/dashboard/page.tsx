"use client";

import dynamic from "next/dynamic";


// Three.js MUST be loaded client-side only — it uses window/document APIs
const Scene = dynamic(() => import("./scene"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#020407",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          fontFamily: "monospace",
          fontSize: 11,
          color: "rgba(0,208,151,0.4)",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}
      >
        Loading 3D scene...
      </span>
    </div>
  ),
});

export default function Dashboard() {
  return <Scene />;
}

