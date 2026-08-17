"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import styles from "./Antigravity.module.css";

type ParticleShape = "capsule" | "sphere" | "box" | "tetrahedron" | "star";

type AntigravityProps = {
  count?: number;
  magnetRadius?: number;
  ringRadius?: number;
  waveSpeed?: number;
  waveAmplitude?: number;
  particleSize?: number;
  lerpSpeed?: number;
  color?: string;
  autoAnimate?: boolean;
  particleVariance?: number;
  rotationSpeed?: number;
  depthFactor?: number;
  pulseSpeed?: number;
  particleShape?: ParticleShape;
  fieldStrength?: number;
  className?: string;
  fixed?: boolean;
  staticField?: boolean;
};

type Particle = {
  t: number;
  speed: number;
  mx: number;
  my: number;
  mz: number;
  cx: number;
  cy: number;
  cz: number;
  randomRadiusOffset: number;
};

const CAMERA_Z = 50;
const FOV = 35;

function getViewportSize(aspect: number) {
  const height = 2 * Math.tan(THREE.MathUtils.degToRad(FOV) / 2) * CAMERA_Z;
  return { width: height * aspect, height };
}

function createStarGeometry() {
  const shape = new THREE.Shape();
  const outer = 0.2;
  const inner = 0.09;
  const points = 5;
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    if (i === 0) shape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    else shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function createGeometry(shape: ParticleShape) {
  switch (shape) {
    case "sphere":
      return new THREE.SphereGeometry(0.2, 16, 16);
    case "box":
      return new THREE.BoxGeometry(0.3, 0.3, 0.3);
    case "tetrahedron":
      return new THREE.TetrahedronGeometry(0.3);
    case "star":
      return createStarGeometry();
    default:
      return new THREE.CapsuleGeometry(0.1, 0.4, 4, 8);
  }
}

export default function Antigravity({
  className = "",
  fixed = false,
  count = 300,
  magnetRadius = 10,
  ringRadius = 10,
  waveSpeed = 0.4,
  waveAmplitude = 1,
  particleSize = 2,
  lerpSpeed = 0.1,
  color = "#ffffff",
  autoAnimate = false,
  particleVariance = 1,
  rotationSpeed = 0,
  depthFactor = 1,
  pulseSpeed = 3,
  particleShape = "capsule",
  fieldStrength = 10,
  staticField = false,
}: AntigravityProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = styles.canvas;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 1000);
    camera.position.z = CAMERA_Z;

    const resize = () => {
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();

    const geometry = createGeometry(particleShape);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.frustumCulled = false;
    scene.add(mesh);

    const initialViewport = getViewportSize(camera.aspect);
    const depthRange = staticField ? 4 : 20;
    const particles: Particle[] = Array.from({ length: count }, () => {
      const x = (Math.random() - 0.5) * initialViewport.width;
      const y = (Math.random() - 0.5) * initialViewport.height;
      const z = (Math.random() - 0.5) * depthRange;
      return {
        t: Math.random() * 100,
        speed: 0.01 + Math.random() / 200,
        mx: x,
        my: y,
        mz: z,
        cx: x,
        cy: y,
        cz: z,
        randomRadiusOffset: (Math.random() - 0.5) * 2,
      };
    });

    const dummy = new THREE.Object3D();
    const pointer = { x: 0, y: 0 };
    const virtualPointer = { x: 0, y: 0 };
    let lastPointerMoveTime = 0;

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = container.getBoundingClientRect();
      const isInside =
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;

      if (!isInside || bounds.width === 0 || bounds.height === 0) return;

      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1);
      lastPointerMoveTime = performance.now();
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    const updateParticles = (elapsedTime: number) => {
      const viewport = getViewportSize(camera.aspect);
      let destinationX = (pointer.x * viewport.width) / 2;
      let destinationY = (pointer.y * viewport.height) / 2;

      if (autoAnimate && performance.now() - lastPointerMoveTime > 2000) {
        destinationX = Math.sin(elapsedTime * 0.5) * (viewport.width / 4);
        destinationY = Math.cos(elapsedTime) * (viewport.height / 4);
      }

      virtualPointer.x += (destinationX - virtualPointer.x) * 0.05;
      virtualPointer.y += (destinationY - virtualPointer.y) * 0.05;

      const targetX = virtualPointer.x;
      const targetY = virtualPointer.y;
      const globalRotation = elapsedTime * rotationSpeed;

      particles.forEach((particle, index) => {
        particle.t += particle.speed / 2;

        const projectionFactor = 1 - particle.cz / 50;
        const projectedTargetX = targetX * projectionFactor;
        const projectedTargetY = targetY * projectionFactor;
        const dx = particle.mx - projectedTargetX;
        const dy = particle.my - projectedTargetY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        let targetXPosition = particle.mx;
        let targetYPosition = particle.my;
        let targetZPosition = particle.mz * depthFactor;

        if (staticField) {
          const cursorActive = performance.now() - lastPointerMoveTime < 2000;
          if (cursorActive) {
            const clusterRadius = 1 + Math.abs(particle.randomRadiusOffset) * 2;
            const clusterAngle = particle.t * 0.5 + particle.randomRadiusOffset * 4;
            targetXPosition = projectedTargetX + Math.cos(clusterAngle) * clusterRadius;
            targetYPosition = projectedTargetY + Math.sin(clusterAngle) * clusterRadius;
            targetZPosition = particle.cz;
          } else {
            targetXPosition = particle.mx + Math.sin(particle.t * 0.5 + particle.cx) * 0.5;
            targetYPosition = particle.my + Math.cos(particle.t * 0.4 + particle.cy) * 0.5;
            targetZPosition = particle.mz * depthFactor;
          }
        } else if (distance < magnetRadius) {
          const angle = Math.atan2(dy, dx) + globalRotation;
          const wave = Math.sin(particle.t * waveSpeed + angle) * (0.5 * waveAmplitude);
          const deviation = particle.randomRadiusOffset * (5 / (fieldStrength + 0.1));
          const currentRingRadius = ringRadius + wave + deviation;

          targetXPosition = projectedTargetX + currentRingRadius * Math.cos(angle);
          targetYPosition = projectedTargetY + currentRingRadius * Math.sin(angle);
          targetZPosition =
            particle.mz * depthFactor + Math.sin(particle.t) * waveAmplitude * depthFactor;
        }

        particle.cx += (targetXPosition - particle.cx) * lerpSpeed;
        particle.cy += (targetYPosition - particle.cy) * lerpSpeed;
        particle.cz += (targetZPosition - particle.cz) * lerpSpeed;

        dummy.position.set(particle.cx, particle.cy, particle.cz);
        if (staticField || particleShape === "star") {
          dummy.quaternion.identity();
        } else {
          dummy.lookAt(projectedTargetX, projectedTargetY, particle.cz);
          dummy.rotateX(Math.PI / 2);
        }

        const distanceToPointer = Math.sqrt(
          (particle.cx - projectedTargetX) ** 2 + (particle.cy - projectedTargetY) ** 2,
        );
        const distanceFromRing = Math.abs(distanceToPointer - ringRadius);
        const ringScale = staticField
          ? 1
          : THREE.MathUtils.clamp(1 - distanceFromRing / 10, 0, 1);
        const pulse = 0.8 + Math.sin(particle.t * pulseSpeed) * 0.2 * particleVariance;
        const finalScale = ringScale * pulse * particleSize;

        dummy.scale.setScalar(finalScale);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });

      mesh.instanceMatrix.needsUpdate = true;
    };

    const clock = new THREE.Clock();
    let rafId = 0;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      updateParticles(clock.getElapsedTime());
      renderer.render(scene, camera);
    };

    animate();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      geometry.dispose();
      material.dispose();
      mesh.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [
    autoAnimate,
    color,
    count,
    depthFactor,
    fieldStrength,
    lerpSpeed,
    magnetRadius,
    particleShape,
    particleSize,
    particleVariance,
    pulseSpeed,
    ringRadius,
    rotationSpeed,
    staticField,
    waveAmplitude,
    waveSpeed,
  ]);

  return (
    <div ref={containerRef} className={`${styles.root}${fixed ? ` ${styles.fixed}` : ""} ${className}`} aria-hidden="true" />
  );
}