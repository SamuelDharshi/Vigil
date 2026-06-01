"use client";

import dynamic from "next/dynamic";

// Three.js uses browser APIs — must be client-only
const Scene = dynamic(() => import("./scene"), { ssr: false });

export default function Dashboard() {
  return <Scene />;
}
