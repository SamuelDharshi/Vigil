/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeBackgroundProps {
  scrollProgress: number; // 0 to 1 representing position on landing page
  volatility: number;     // 0.1 to 2.0 to dynamic animate speed/turbulence
  enableOrbit?: boolean;  // enable mouse drag orbit (for dedicated 3D page)
  theme?: 'dark' | 'light';
}

export default function ThreeBackground({ scrollProgress, volatility, enableOrbit = false, theme = 'dark' }: ThreeBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(scrollProgress);
  const orbitRef = useRef({ azimuth: 0, elevation: 0.3, dragging: false, lastX: 0, lastY: 0 });

  // Sync scrollProgress to ref for use in animation loop
  useEffect(() => {
    scrollRef.current = scrollProgress;
  }, [scrollProgress]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // SCENE & CAMERA
    const scene = new THREE.Scene();
    const fogColor = theme === 'light' ? 0xf8fafc : 0x020202;
    scene.fog = new THREE.FogExp2(fogColor, 0.015);

    const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 1000);
    camera.position.set(0, 20, 45);
    camera.lookAt(0, 5, 0);

    // RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(fogColor, 1);
    container.appendChild(renderer.domElement);

    // MOUSE DRAG ORBIT
    const orbit = orbitRef.current;
    const onMouseDown = (e: MouseEvent) => { orbit.dragging = true; orbit.lastX = e.clientX; orbit.lastY = e.clientY; };
    const onMouseUp   = () => { orbit.dragging = false; };
    const onMouseMove = (e: MouseEvent) => {
      if (!orbit.dragging) return;
      orbit.azimuth   -= (e.clientX - orbit.lastX) * 0.005;
      orbit.elevation -= (e.clientY - orbit.lastY) * 0.004;
      orbit.elevation  = Math.max(-0.6, Math.min(1.0, orbit.elevation));
      orbit.lastX = e.clientX;
      orbit.lastY = e.clientY;
    };
    const onTouchStart = (e: TouchEvent) => { orbit.dragging = true; orbit.lastX = e.touches[0].clientX; orbit.lastY = e.touches[0].clientY; };
    const onTouchEnd   = () => { orbit.dragging = false; };
    const onTouchMove  = (e: TouchEvent) => {
      if (!orbit.dragging) return;
      orbit.azimuth   -= (e.touches[0].clientX - orbit.lastX) * 0.005;
      orbit.elevation -= (e.touches[0].clientY - orbit.lastY) * 0.004;
      orbit.lastX = e.touches[0].clientX;
      orbit.lastY = e.touches[0].clientY;
    };
    if (enableOrbit) {
      renderer.domElement.addEventListener('mousedown',  onMouseDown);
      renderer.domElement.addEventListener('mousemove',  onMouseMove);
      renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
      renderer.domElement.addEventListener('touchmove',  onTouchMove,  { passive: true });
      window.addEventListener('mouseup',   onMouseUp);
      window.addEventListener('touchend',  onTouchEnd);
    }

    // LIGHTS
    const ambientLight = new THREE.AmbientLight(0x0a0a0a, 1.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0x00ff7f, 1.8);
    directionalLight.position.set(30, 50, 10);
    scene.add(directionalLight);

    const secondaryLight = new THREE.PointLight(0x00f0ff, 2, 50);
    secondaryLight.position.set(-20, 10, -10);
    scene.add(secondaryLight);

    const accentLight = new THREE.PointLight(0xd000ff, 2.5, 60);
    accentLight.position.set(20, 25, 20);
    scene.add(accentLight);

    // 1. NEON GRID
    const gridSize = 100;
    const gridDivisions = 40;
    const gridColor1 = new THREE.Color(0x00ff7f); // Mantle Neon Green
    const gridColor2 = new THREE.Color(0x131722); // Deep dark blue-gray
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, gridColor1, gridColor2);
    gridHelper.position.y = -2;
    // Add custom grid opacity material hack
    if (gridHelper.material instanceof THREE.Material) {
      gridHelper.material.transparent = true;
      gridHelper.material.opacity = 0.35;
    }
    scene.add(gridHelper);

    // 2. CANDLESTICKS (3D Trading Market)
    const candlesGroup = new THREE.Group();
    const candleCount = 28;
    const candleSpacing = 2.5;
    const startX = -(candleCount * candleSpacing) / 2;

    const candleMeshes: Array<{
      body: THREE.Mesh;
      wick: THREE.Line;
      baseY: number;
      targetHeight: number;
      speed: number;
    }> = [];

    for (let i = 0; i < candleCount; i++) {
      const isUp = Math.random() > 0.45;
      const color = isUp ? 0x00ff7f : 0xff0052; // Neon green vs neon pink-red
      const x = startX + i * candleSpacing;
      
      // Random height parameters
      const bodyHeight = 2 + Math.random() * 8;
      const centerY = bodyHeight / 2;
      const z = -15 + Math.sin(i * 0.5) * 8 + (Math.random() - 0.5) * 3;

      // Candle body
      const bodyGeom = new THREE.BoxGeometry(0.8, bodyHeight, 0.8);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.1,
        metalness: 0.8,
        emissive: color,
        emissiveIntensity: 0.2,
        transparent: true,
        opacity: 0.85,
      });
      const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
      bodyMesh.position.set(x, centerY, z);

      // Wick
      const wickGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, bodyHeight + 1.2, z),
        new THREE.Vector3(x, -0.8, z)
      ]);
      const wickMat = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.6,
      });
      const wickLine = new THREE.Line(wickGeom, wickMat);

      candlesGroup.add(bodyMesh);
      candlesGroup.add(wickLine);

      candleMeshes.push({
        body: bodyMesh,
        wick: wickLine,
        baseY: centerY,
        targetHeight: bodyHeight,
        speed: 0.01 + Math.random() * 0.02,
      });
    }
    scene.add(candlesGroup);

    // 3. DATAPACKETS (Flying Particles along bezier paths)
    const curves: THREE.CatmullRomCurve3[] = [];
    for (let k = 0; k < 6; k++) {
      const start = new THREE.Vector3(-40 + Math.random() * 10, -1, -25 + Math.random() * 10);
      const ctrl1 = new THREE.Vector3(-20 + Math.random() * 15, 10 + Math.random() * 15, -10 + Math.random() * 10);
      const ctrl2 = new THREE.Vector3(10 + Math.random() * 20, 5 + Math.random() * 12, 10 + Math.random() * 10);
      const end = new THREE.Vector3(40 - Math.random() * 10, -1, 15 - Math.random() * 15);
      curves.push(new THREE.CatmullRomCurve3([start, ctrl1, ctrl2, end]));
    }

    const packetsGroup = new THREE.Group();
    const packetData: Array<{
      mesh: THREE.Mesh;
      curveIndex: number;
      progress: number;
      speed: number;
    }> = [];

    const packetGeom = new THREE.SphereGeometry(0.35, 12, 12);
    curves.forEach((curve, index) => {
      // Create path visualizer line
      const points = curve.getPoints(50);
      const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color: index % 2 === 0 ? 0x00f0ff : 0xd000ff,
        transparent: true,
        opacity: 0.15,
      });
      const line = new THREE.Line(lineGeom, lineMat);
      scene.add(line);

      // Create 2 floating packets per curve
      for (let p = 0; p < 2; p++) {
        const neonColor = index % 2 === 0 ? 0x00f0ff : 0xd000ff;
        const packetMat = new THREE.MeshBasicMaterial({
          color: neonColor,
          transparent: true,
          opacity: 0.9,
        });
        const mesh = new THREE.Mesh(packetGeom, packetMat);
        mesh.position.copy(curve.getPointAt(0));
        packetsGroup.add(mesh);
        packetData.push({
          mesh,
          curveIndex: index,
          progress: Math.random(),
          speed: 0.002 + Math.random() * 0.004,
        });
      }
    });
    scene.add(packetsGroup);

    // 4. FLOATING DATA NODES
    const nodeCount = 15;
    const nodesGroup = new THREE.Group();
    const nodeDataRef: Array<{
      mesh: THREE.Mesh;
      core: THREE.Mesh;
      baseX: number;
      baseY: number;
      baseZ: number;
      phi: number;
    }> = [];

    for (let j = 0; j < nodeCount; j++) {
      const outerGeom = new THREE.IcosahedronGeometry(0.65, 0);
      const innerGeom = new THREE.SphereGeometry(0.2, 8, 8);
      const col = j % 3 === 0 ? 0x00ff7f : j % 3 === 1 ? 0x00f0ff : 0xd000ff;

      const outerMat = new THREE.MeshPhysicalMaterial({
        color: col,
        wireframe: true,
        emissive: col,
        emissiveIntensity: 0.5,
      });
      const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

      const nMesh = new THREE.Mesh(outerGeom, outerMat);
      const iMesh = new THREE.Mesh(innerGeom, innerMat);
      nMesh.add(iMesh);

      const bx = -25 + Math.random() * 50;
      const by = 2 + Math.random() * 15;
      const bz = -30 + Math.random() * 40;
      nMesh.position.set(bx, by, bz);

      nodesGroup.add(nMesh);
      nodeDataRef.push({
        mesh: nMesh,
        core: iMesh,
        baseX: bx,
        baseY: by,
        baseZ: bz,
        phi: Math.random() * Math.PI * 2,
      });
    }
    scene.add(nodesGroup);

    // ANIMATION LOOP
    let animationId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const elapsed = clock.getElapsedTime();
      const currentScroll = scrollRef.current;
      const o = orbitRef.current;

      if (enableOrbit) {
        // Orbit mode: auto-rotate azimuth slowly, user drag overrides
        if (!o.dragging) o.azimuth += 0.004;
        const radius = 48;
        camera.position.x = Math.sin(o.azimuth) * radius * Math.cos(o.elevation);
        camera.position.y = Math.sin(o.elevation) * radius * 0.6 + 10;
        camera.position.z = Math.cos(o.azimuth) * radius * Math.cos(o.elevation);
        camera.lookAt(0, 4, 0);
      } else {
        // Scroll-driven mode (landing page) - Zoomed out and centered behind text
        const targetCamX = Math.sin(elapsed * 0.05) * 15 + Math.sin(currentScroll * Math.PI) * 10;
        const targetCamY = 22 - currentScroll * 15; // Revert to original height to lift elements behind text
        const targetCamZ = 54 - currentScroll * 25 + Math.cos(elapsed * 0.03) * 5; // Zoomed out from 45, but closer than 68
        
        camera.position.x += (targetCamX - camera.position.x) * 0.03;
        camera.position.y += (targetCamY - camera.position.y) * 0.03;
        camera.position.z += (targetCamZ - camera.position.z) * 0.03;
        
        const lookTarget = new THREE.Vector3(0, 5 - currentScroll * 5, -currentScroll * 10);
        camera.lookAt(lookTarget);
      }

      // Animate candlesticks (pulsating under market volatility)
      candleMeshes.forEach((candle, idx) => {
        // Floating motion
        const heightMultiplier = 1.0 + Math.sin(elapsed * 1.5 * candle.speed + idx) * 0.15 * volatility;
        const currentHeight = candle.targetHeight * heightMultiplier;
        
        candle.body.scale.y = heightMultiplier;
        // Adjust position so candle scales from the base ground line, not the center
        candle.body.position.y = (currentHeight / 2);
        
        // Slightly rotate candle body to look organic
        candle.body.rotation.y += 0.005 * volatility;
      });

      // Animate flying data packets
      packetData.forEach((packet) => {
        packet.progress += packet.speed * volatility;
        if (packet.progress > 1) {
          packet.progress = 0;
        }
        const curve = curves[packet.curveIndex];
        const newPos = curve.getPointAt(packet.progress);
        packet.mesh.position.copy(newPos);
      });

      // Animate node rotations & floating hover
      nodeDataRef.forEach((node, idx) => {
        node.mesh.rotation.y += 0.008 * volatility;
        node.mesh.rotation.x += 0.004 * volatility;

        // Floating hover
        const bounce = Math.sin(elapsed * 0.8 + node.phi) * 0.6 * volatility;
        node.mesh.position.y = node.baseY + bounce;
        
        // Inner core pulse
        const pulse = 0.75 + Math.sin(elapsed * 3 + idx) * 0.25;
        node.core.scale.set(pulse, pulse, pulse);
      });

      // Rotate entire grid very slowly based on mouse moves or time
      gridHelper.rotation.y = elapsed * 0.02;

      renderer.render(scene, camera);
    };

    animate();

    // RESIZE OBSERVER
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    // CLEANUP
    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      if (enableOrbit) {
        renderer.domElement.removeEventListener('mousedown',  onMouseDown);
        renderer.domElement.removeEventListener('mousemove',  onMouseMove);
        renderer.domElement.removeEventListener('touchstart', onTouchStart);
        renderer.domElement.removeEventListener('touchmove',  onTouchMove);
        window.removeEventListener('mouseup',  onMouseUp);
        window.removeEventListener('touchend', onTouchEnd);
      }
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      scene.clear();
      renderer.dispose();
    };
  }, [volatility, enableOrbit, theme]);

  return <div id="three-canvas-root" ref={containerRef} className="absolute inset-0 w-full h-full z-0" style={{ cursor: enableOrbit ? 'grab' : 'default' }} />;
}
