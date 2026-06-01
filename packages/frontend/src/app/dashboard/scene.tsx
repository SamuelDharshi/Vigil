"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { getWebSocket } from "@/lib/ws";
import Link from "next/link";

// ─── Agent data ────────────────────────────────────────────────────────────────
interface AgentNode {
  id: number;
  name: string;
  role: string;
  status: "idle" | "thinking" | "executing" | "skipping";
  confidence: number;
  decisions: number;
  executed: number;
  lastAction: string;
  threeColor: number;
  cssColor: string;
}

const INITIAL_AGENTS: AgentNode[] = [
  { id: 1, name: "VIGIL-α", role: "Primary · RWA Rebalancer",   status: "idle", confidence: 2,  decisions: 0, executed: 0, lastAction: "Awaiting next 30-min cycle...",  threeColor: 0x00d097, cssColor: "#00d097" },
  { id: 2, name: "VIGIL-β", role: "Yield · CLMM Router",        status: "idle", confidence: 0,  decisions: 0, executed: 0, lastAction: "Monitoring Byreal pool APRs...",  threeColor: 0x8b5cf6, cssColor: "#8b5cf6" },
  { id: 3, name: "VIGIL-γ", role: "Bridge · Cross-Chain Scout",  status: "idle", confidence: 0,  decisions: 0, executed: 0, lastAction: "Watching Super Portal...",       threeColor: 0x3b82f6, cssColor: "#3b82f6" },
];

const ORBIT_RADII  = [7, 10.5, 14];
const ORBIT_SPEEDS = [0.38, 0.25, 0.16]; // rad/s
const ORBIT_PHASES = [0, 2.09, 4.19];    // 120° apart

// ─── Three.js Scene ────────────────────────────────────────────────────────────
function ThreeCanvas({
  agentsRef,
  labelRefs,
}: {
  agentsRef: React.MutableRefObject<AgentNode[]>;
  labelRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ─ Renderer (Three.js creates its own canvas and appends to container)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // ─ Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020407);
    scene.fog = new THREE.FogExp2(0x020407, 0.028);

    // ─ Camera
    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 300);
    camera.position.set(0, 10, 26);
    camera.lookAt(0, 0, 0);

    // ─ Controls (attached to renderer.domElement, not a canvas ref)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 6;
    controls.maxDistance = 55;
    controls.maxPolarAngle = Math.PI * 0.82;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.25;

    // ─ Lights
    scene.add(new THREE.AmbientLight(0x08080f, 3));
    const vaultLight = new THREE.PointLight(0xffd060, 6, 35);
    scene.add(vaultLight);
    const rimA = new THREE.DirectionalLight(0x00d097, 0.7);
    rimA.position.set(-12, 8, 6);
    scene.add(rimA);
    const rimB = new THREE.DirectionalLight(0x8b5cf6, 0.4);
    rimB.position.set(12, -4, -8);
    scene.add(rimB);

    // ─ Stars
    const starGeo = new THREE.BufferGeometry();
    const starCount = 4000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) starPos[i] = (Math.random() - 0.5) * 250;
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0.55 })));

    // ─ Grid floor
    const gridHelper = new THREE.GridHelper(80, 50, 0x002218, 0x001510);
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.6;
    gridHelper.position.y = -7;
    scene.add(gridHelper);

    // ─ Central Vault
    const vaultGeo = new THREE.IcosahedronGeometry(2.2, 3);
    const vaultMat = new THREE.MeshStandardMaterial({
      color: 0xffd060, emissive: 0xff9500,
      emissiveIntensity: 0.5, metalness: 0.95, roughness: 0.08,
    });
    const vault = new THREE.Mesh(vaultGeo, vaultMat);
    scene.add(vault);

    // Vault wireframe shell
    const vaultWire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.3, 3),
      new THREE.MeshBasicMaterial({ color: 0xffd060, wireframe: true, transparent: true, opacity: 0.07 })
    );
    scene.add(vaultWire);

    // Vault outer glow shell
    const vaultGlow = new THREE.Mesh(
      new THREE.SphereGeometry(4, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.035, side: THREE.BackSide })
    );
    scene.add(vaultGlow);

    // Equatorial ring
    const equatorRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.2, 0.025, 8, 80),
      new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.35 })
    );
    equatorRing.rotation.x = Math.PI / 2;
    scene.add(equatorRing);

    // ─ Orbit paths
    ORBIT_RADII.forEach((r, i) => {
      const colors = [0x00d097, 0x8b5cf6, 0x3b82f6];
      scene.add(new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.018, 8, 128),
        new THREE.MeshBasicMaterial({ color: colors[i], transparent: true, opacity: 0.12, side: THREE.DoubleSide })
      ));
      // Orbit ring tilted slightly for each agent
      const mesh = scene.children[scene.children.length - 1] as THREE.Mesh;
      mesh.rotation.x = Math.PI / 2;
      mesh.rotation.z = i * 0.12;
    });

    // ─ Agent meshes
    const agentMeshes: THREE.Mesh[] = [];
    const agentHalos: THREE.Mesh[] = [];
    const agentColors = [0x00d097, 0x8b5cf6, 0x3b82f6];

    ORBIT_RADII.forEach((_, i) => {
      const color = new THREE.Color(agentColors[i]);

      // Core sphere
      const mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.75, 2),
        new THREE.MeshStandardMaterial({
          color, emissive: color, emissiveIntensity: 0.7,
          metalness: 0.2, roughness: 0.5,
        })
      );
      scene.add(mesh);
      agentMeshes.push(mesh);

      // Halo / bloom shell
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 16, 16),
        new THREE.MeshBasicMaterial({ color: agentColors[i], transparent: true, opacity: 0.07, side: THREE.BackSide })
      );
      scene.add(halo);
      agentHalos.push(halo);
    });

    // ─ Particles: signal streams from agents → vault center
    const particleGroups: { pts: THREE.Points; agentIdx: number; phases: Float32Array }[] = [];
    const particleColors = [0x00d097, 0x8b5cf6, 0x3b82f6];
    ORBIT_RADII.forEach((_, idx) => {
      const count = 70;
      const phases = new Float32Array(count);
      for (let i = 0; i < count; i++) phases[i] = Math.random();
      const positions = new Float32Array(count * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const pts = new THREE.Points(
        geo,
        new THREE.PointsMaterial({ color: particleColors[idx], size: 0.09, transparent: true, opacity: 0.6, sizeAttenuation: true })
      );
      scene.add(pts);
      particleGroups.push({ pts, agentIdx: idx, phases });
    });

    // ─ Inter-agent data lines
    const ARC_PAIRS: [number, number][] = [[0, 1], [1, 2], [0, 2]];
    const arcLines: THREE.Line[] = [];
    ARC_PAIRS.forEach(() => {
      const points = Array.from({ length: 30 }, (_, t) => new THREE.Vector3(0, 0, 0));
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x1a2a3a, transparent: true, opacity: 0.3 }));
      scene.add(line);
      arcLines.push(line);
    });

    // ─ Animation loop
    let rafId: number;
    const startTime = Date.now();

    function animate() {
      rafId = requestAnimationFrame(animate);
      const t = (Date.now() - startTime) / 1000;
      controls.update();

      // Pulse vault
      const vp = 1 + Math.sin(t * 1.6) * 0.03;
      vault.scale.setScalar(vp);
      vault.rotation.y = t * 0.09;
      vault.rotation.x = Math.sin(t * 0.12) * 0.08;
      vaultMat.emissiveIntensity = 0.4 + Math.sin(t * 2.1) * 0.18;
      vaultLight.intensity = 5 + Math.sin(t * 1.9) * 2;

      // Move agents + update labels
      agentMeshes.forEach((mesh, i) => {
        const agent = agentsRef.current[i];
        const angle = ORBIT_PHASES[i] + t * ORBIT_SPEEDS[i];
        const r = ORBIT_RADII[i];
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const y = Math.sin(t * 0.35 + i * 2.1) * 0.8;
        mesh.position.set(x, y, z);
        agentHalos[i].position.set(x, y, z);

        // Emissive pulse based on status
        const mat = mesh.material as THREE.MeshStandardMaterial;
        const baseEI =
          agent.status === "executing" ? 1.3 :
          agent.status === "thinking"  ? 0.9 :
          agent.status === "skipping"  ? 0.35 : 0.5;
        mat.emissiveIntensity = baseEI + Math.sin(t * 3 + i * 1.5) * 0.12;

        const haloMat = agentHalos[i].material as THREE.MeshBasicMaterial;
        haloMat.opacity =
          agent.status === "executing" ? 0.2 + Math.sin(t * 4) * 0.07 :
          agent.status === "thinking"  ? 0.13 + Math.sin(t * 3) * 0.04 : 0.07;

        // Project to screen for HTML label
        const labelEl = labelRefs.current[i];
        if (labelEl) {
          const vec = mesh.position.clone().project(camera);
          const hw = container.clientWidth / 2;
          const hh = container.clientHeight / 2;
          const sx = Math.round(vec.x * hw + hw);
          const sy = Math.round(-vec.y * hh + hh);
          labelEl.style.left = `${sx}px`;
          labelEl.style.top  = `${sy + 28}px`; // below sphere
          labelEl.style.opacity = vec.z < 1 ? "1" : "0";
        }
      });

      // Particles flowing from agent → vault
      particleGroups.forEach(({ pts, agentIdx, phases }) => {
        const agent = agentMeshes[agentIdx];
        const pos = pts.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < phases.length; i++) {
          const phase = (phases[i] + t * 0.22) % 1;
          pos[i * 3 + 0] = agent.position.x * (1 - phase);
          pos[i * 3 + 1] = agent.position.y * (1 - phase) + phase * 0.5;
          pos[i * 3 + 2] = agent.position.z * (1 - phase);
        }
        pts.geometry.attributes.position.needsUpdate = true;
        (pts.material as THREE.PointsMaterial).opacity = 0.35 + Math.sin(t * 1.8 + agentIdx) * 0.2;
      });

      // Inter-agent arc lines
      ARC_PAIRS.forEach(([a, b], lineIdx) => {
        const pa = agentMeshes[a].position;
        const pb = agentMeshes[b].position;
        const mid = new THREE.Vector3().addVectors(pa, pb).multiplyScalar(0.5);
        mid.y += 3.5;
        const curve = new THREE.QuadraticBezierCurve3(pa.clone(), mid, pb.clone());
        const pts = curve.getPoints(29);
        const buf = arcLines[lineIdx].geometry.attributes.position.array as Float32Array;
        pts.forEach((p, k) => { buf[k * 3] = p.x; buf[k * 3 + 1] = p.y; buf[k * 3 + 2] = p.z; });
        arcLines[lineIdx].geometry.attributes.position.needsUpdate = true;
        (arcLines[lineIdx].material as THREE.LineBasicMaterial).opacity = 0.15 + Math.sin(t * 2 + lineIdx) * 0.08;
      });

      renderer.render(scene, camera);
    }
    animate();

    // ─ Resize handling
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}

// ─── Agent HUD Card ────────────────────────────────────────────────────────────
function AgentCard({ agent }: { agent: AgentNode }) {
  const statusColor = agent.status === "executing" ? "#00d097" : agent.status === "thinking" ? "#f59e0b" : agent.status === "skipping" ? "#ef4444" : "rgba(255,255,255,0.25)";
  const statusLabel = agent.status === "executing" ? "EXECUTING" : agent.status === "thinking" ? "THINKING" : agent.status === "skipping" ? "SKIPPING" : "WATCHING";

  return (
    <div style={{
      flex: 1, minWidth: 0,
      padding: 16,
      background: "rgba(2,4,7,0.88)",
      backdropFilter: "blur(24px)",
      borderRadius: 12,
      border: `0.5px solid ${agent.cssColor}22`,
      boxShadow: `0 0 24px ${agent.cssColor}0a`,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: agent.cssColor, boxShadow: `0 0 8px ${agent.cssColor}`, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "white", fontWeight: 600 }}>{agent.name}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 1 }}>{agent.role}</div>
        </div>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 9, padding: "2px 7px", borderRadius: 4,
          background: `${agent.cssColor}18`, color: statusColor,
          border: `0.5px solid ${statusColor}44`,
          flexShrink: 0,
        }}>
          {statusLabel}
        </span>
      </div>

      {/* Confidence bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Confidence</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: agent.cssColor, fontWeight: 600 }}>{agent.confidence.toFixed(1)}%</span>
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${Math.min(100, agent.confidence)}%`,
            background: `linear-gradient(90deg, ${agent.cssColor}66, ${agent.cssColor})`,
            borderRadius: 3,
            transition: "width 1s ease",
            boxShadow: agent.confidence >= 30 ? `0 0 8px ${agent.cssColor}` : "none",
          }} />
        </div>
        <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,0.2)" }}>
          {agent.confidence >= 30 ? "▲ THRESHOLD MET — WILL EXECUTE" : `${(30 - agent.confidence).toFixed(1)}% below 30% threshold`}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          { label: "Decisions", value: agent.decisions.toString(), color: "rgba(255,255,255,0.7)" },
          { label: "Executed", value: agent.executed.toString(), color: agent.cssColor },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, color: s.color, fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Last action */}
      <div style={{
        padding: "7px 10px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: 6,
        border: "0.5px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Last Action</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{agent.lastAction}</div>
      </div>
    </div>
  );
}

// ─── Top Nav ────────────────────────────────────────────────────────────────────
function TopNav({ wsConnected }: { wsConnected: boolean }) {
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 52,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 24px",
      background: "linear-gradient(180deg, rgba(2,4,7,0.95) 0%, transparent 100%)",
      zIndex: 20,
      pointerEvents: "auto",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00d097", boxShadow: "0 0 10px #00d097", animation: "dotPulse 2s ease-in-out infinite" }} />
        <span style={{ fontFamily: "Instrument Serif, serif", fontSize: 22, color: "white", letterSpacing: "-0.02em" }}>VIGIL</span>
        <span style={{ fontFamily: "DM Mono, monospace", fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.15em" }}>
          Multi-Agent Dashboard
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontFamily: "DM Mono, monospace", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>Mantle Sepolia</span>
        <span style={{
          fontFamily: "DM Mono, monospace", fontSize: 10, padding: "3px 10px", borderRadius: 4,
          background: wsConnected ? "rgba(0,208,151,0.1)" : "rgba(239,68,68,0.1)",
          color: wsConnected ? "#00d097" : "#ef4444",
          border: `0.5px solid ${wsConnected ? "rgba(0,208,151,0.3)" : "rgba(239,68,68,0.3)"}`,
        }}>
          {wsConnected ? "● LIVE" : "○ CONNECTING"}
        </span>
        <Link
          href="/warroom"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            fontFamily: "DM Mono, monospace", fontSize: 10,
            padding: "4px 12px", borderRadius: 5,
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.5)",
            border: "0.5px solid rgba(255,255,255,0.1)",
            textDecoration: "none",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "#00d097"; e.currentTarget.style.borderColor = "rgba(0,208,151,0.3)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
        >
          ≡ War Room
        </Link>
        <Link
          href="/"
          style={{
            fontFamily: "DM Mono, monospace", fontSize: 10,
            padding: "4px 12px", borderRadius: 5,
            background: "rgba(255,255,255,0.03)",
            color: "rgba(255,255,255,0.3)",
            border: "0.5px solid rgba(255,255,255,0.07)",
            textDecoration: "none",
          }}
        >
          ← Home
        </Link>
      </div>
    </div>
  );
}

// ─── Vault center label ─────────────────────────────────────────────────────────
function VaultLabel() {
  return (
    <div style={{
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%, -80px)",
      textAlign: "center", pointerEvents: "none", zIndex: 5,
    }}>
      <div style={{ fontFamily: "DM Mono, monospace", fontSize: 9, color: "rgba(255,215,0,0.45)", textTransform: "uppercase", letterSpacing: "0.25em" }}>VIGILVault</div>
      <div style={{ fontFamily: "DM Mono, monospace", fontSize: 8, color: "rgba(255,255,255,0.15)", marginTop: 2 }}>Mantle Sepolia</div>
    </div>
  );
}

// ─── Main Dashboard Scene ──────────────────────────────────────────────────────
export default function Scene() {
  const [agents, setAgents] = useState<AgentNode[]>(INITIAL_AGENTS);
  const agentsRef = useRef<AgentNode[]>(INITIAL_AGENTS);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const [wsConnected, setWsConnected] = useState(false);

  // Keep ref in sync
  useEffect(() => { agentsRef.current = agents; }, [agents]);

  // WebSocket: wire real data into VIGIL-α, simulate β and γ
  useEffect(() => {
    const ws = getWebSocket();
    ws.connect();

    const unsubInitial = ws.on("INITIAL_STATE", (msg: any) => {
      setWsConnected(true);
      if (msg.agentStats) {
        setAgents(prev => {
          const u = [...prev];
          u[0] = { ...u[0], decisions: msg.agentStats.total_decisions ?? 0, executed: msg.agentStats.total_executed ?? 0 };
          return u;
        });
      }
      if (msg.entries?.length > 0) {
        const last = msg.entries[0];
        const conf = (last.confidence / 10000) * 100;
        const LABELS = ["SKIP", "EXECUTE", "CROSS-CHAIN", "CLMM"];
        setAgents(prev => {
          const u = [...prev];
          u[0] = {
            ...u[0], confidence: conf,
            status: last.entry_type === 0 ? "skipping" : "executing",
            lastAction: last.entry_type === 0
              ? `SKIP — ${last.skip_reason || "Confidence below threshold"}`
              : `EXECUTED — ${LABELS[last.entry_type]}`,
          };
          return u;
        });
      }
    });

    const unsubEntry = ws.on("LEDGER_ENTRY", (msg: any) => {
      const conf = (msg.confidence / 10000) * 100;
      const LABELS = ["SKIP", "EXECUTE", "CROSS-CHAIN", "CLMM"];
      setAgents(prev => {
        const u = [...prev];
        u[0] = {
          ...u[0], confidence: conf,
          decisions: u[0].decisions + 1,
          executed: msg.entry_type !== 0 ? u[0].executed + 1 : u[0].executed,
          status: msg.entry_type === 0 ? "skipping" : "executing",
          lastAction: msg.entry_type === 0
            ? `SKIP — ${msg.skip_reason || "Confidence below threshold"}`
            : `EXECUTED — ${LABELS[msg.entry_type]}`,
        };
        return u;
      });
      setTimeout(() => {
        setAgents(prev => { const u = [...prev]; u[0] = { ...u[0], status: "idle" }; return u; });
      }, 6000);
    });

    const unsubStats = ws.on("AGENT_STATS", (msg: any) => {
      if (msg.stats) {
        setAgents(prev => {
          const u = [...prev];
          u[0] = { ...u[0], decisions: msg.stats.total_decisions ?? u[0].decisions, executed: msg.stats.total_executed ?? u[0].executed };
          return u;
        });
      }
    });

    const unsubHb = ws.on("HEARTBEAT", () => setWsConnected(true));

    // Simulate β and γ with small random drift
    const sim = setInterval(() => {
      setAgents(prev => {
        const u = [...prev];
        [1, 2].forEach(i => {
          const drift = (Math.random() - 0.5) * 1.5;
          const newConf = Math.max(0, Math.min(18, (u[i].confidence ?? 0) + drift));
          u[i] = {
            ...u[i],
            confidence: newConf,
            status: newConf > 10 ? "thinking" : "idle",
            lastAction: newConf > 12 ? "Evaluating yield opportunity..." : newConf > 6 ? "Signal too weak — watching..." : u[i].lastAction,
          };
        });
        return u;
      });
    }, 7000);

    return () => { unsubInitial(); unsubEntry(); unsubStats(); unsubHb(); clearInterval(sim); };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden", background: "#020407" }}>
      <style>{`
        @keyframes dotPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes labelFadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* 3D Canvas (fills entire background) */}
      <ThreeCanvas agentsRef={agentsRef} labelRefs={labelRefs} />

      {/* HTML labels that follow 3D agent positions */}
      {agents.map((agent, i) => (
        <div
          key={agent.id}
          ref={el => { labelRefs.current[i] = el; }}
          style={{
            position: "absolute",
            transform: "translateX(-50%)",
            pointerEvents: "none",
            zIndex: 10,
            textAlign: "center",
            transition: "opacity 0.3s ease",
          }}
        >
          <div style={{ fontFamily: "DM Mono, monospace", fontSize: 10, color: agent.cssColor, fontWeight: 600, letterSpacing: "0.08em", textShadow: `0 0 12px ${agent.cssColor}` }}>{agent.name}</div>
          <div style={{ fontFamily: "DM Mono, monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{agent.confidence.toFixed(1)}%</div>
        </div>
      ))}

      {/* Vault label */}
      <VaultLabel />

      {/* Top navigation */}
      <TopNav wsConnected={wsConnected} />

      {/* Bottom HUD — agent cards */}
      <div style={{
        position: "absolute", bottom: 24, left: 24, right: 24,
        display: "flex", gap: 14,
        zIndex: 20, pointerEvents: "auto",
      }}>
        {agents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
      </div>

      {/* Bottom-right hint */}
      <div style={{
        position: "absolute", bottom: 28, right: 28,
        fontFamily: "DM Mono, monospace", fontSize: 9,
        color: "rgba(255,255,255,0.15)",
        zIndex: 5, pointerEvents: "none",
        display: "none", // hidden on mobile, shown on wider screens via inline override
      }} className="orbit-hint">
        drag to orbit · scroll to zoom
      </div>
    </div>
  );
}
