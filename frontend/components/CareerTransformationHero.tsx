"use client";

import { useEffect, useRef } from "react";
import { BadgeCheck, Database, Sparkles } from "lucide-react";

type BodyPart = "head" | "torso" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg";

type Particle = {
  x: number;
  y: number;
  tx: number;
  ty: number;
  size: number;
  phase: number;
  speed: number;
  accent: boolean;
  part: BodyPart;
};

function seeded(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function pointInHuman(index: number, total: number, width: number, height: number) {
  const mobile = width < 768;
  const cx = width * (mobile ? 0.56 : 0.77);
  const cy = height * (mobile ? 0.69 : 0.53);
  const scale = Math.min(width, height) * (mobile ? 0.23 : 0.29);
  const part = index / total;
  const a = seeded(index + 3);
  const b = seeded(index + 29);

  if (part < 0.18) {
    const angle = a * Math.PI * 2;
    const radius = Math.sqrt(b) * scale * 0.19;
    return [cx + Math.cos(angle) * radius, cy - scale * 0.82 + Math.sin(angle) * radius] as const;
  }
  if (part < 0.57) {
    const y = b * scale * 0.92;
    const taper = 1 - y / (scale * 1.8);
    return [cx + (a - 0.5) * scale * (0.55 + taper * 0.16), cy - scale * 0.58 + y] as const;
  }
  if (part < 0.73) {
    const side = part < 0.65 ? -1 : 1;
    const t = b;
    return [
      cx + side * scale * (0.29 + t * 0.48),
      cy - scale * 0.45 + t * scale * 0.72 + (a - 0.5) * scale * 0.08,
    ] as const;
  }
  const side = part < 0.865 ? -1 : 1;
  const t = b;
  return [
    cx + side * scale * (0.14 + t * 0.18) + (a - 0.5) * scale * 0.08,
    cy + scale * 0.32 + t * scale * 0.9,
  ] as const;
}

function bodyPart(index: number, total: number): BodyPart {
  const part = index / total;
  if (part < 0.18) return "head";
  if (part < 0.57) return "torso";
  if (part < 0.65) return "leftArm";
  if (part < 0.73) return "rightArm";
  if (part < 0.865) return "leftLeg";
  return "rightLeg";
}

function rotateAround(x: number, y: number, cx: number, cy: number, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos] as const;
}

function animatedHumanTarget(
  particle: Particle,
  width: number,
  height: number,
  time: number,
  reducedMotion: boolean,
) {
  if (reducedMotion) return [particle.tx, particle.ty] as const;

  const mobile = width < 768;
  const cx = width * (mobile ? 0.56 : 0.77);
  const cy = height * (mobile ? 0.69 : 0.53);
  const scale = Math.min(width, height) * (mobile ? 0.23 : 0.29);
  const breath = Math.sin(time * 0.00145);
  const stride = Math.sin(time * 0.00105);
  let x = particle.tx;
  let y = particle.ty;

  if (particle.part === "head") {
    [x, y] = rotateAround(x, y, cx, cy - scale * 0.62, stride * 0.055);
    y += breath * scale * 0.012;
  } else if (particle.part === "torso") {
    x = cx + (x - cx) * (1 + breath * 0.026);
    y += breath * scale * 0.008;
  } else if (particle.part === "leftArm" || particle.part === "rightArm") {
    const side = particle.part === "leftArm" ? -1 : 1;
    const shoulderX = cx + side * scale * 0.29;
    const shoulderY = cy - scale * 0.43;
    [x, y] = rotateAround(x, y, shoulderX, shoulderY, side * stride * 0.16);
  } else {
    const side = particle.part === "leftLeg" ? -1 : 1;
    const hipX = cx + side * scale * 0.13;
    const hipY = cy + scale * 0.28;
    [x, y] = rotateAround(x, y, hipX, hipY, -side * stride * 0.065);
  }

  [x, y] = rotateAround(x, y, cx, cy + scale * 0.28, Math.sin(time * 0.00072) * 0.025);
  x += Math.sin(time * 0.00072) * scale * 0.028;
  y += Math.sin(time * 0.00108 + 0.7) * scale * 0.012;
  return [x, y] as const;
}

function drawJourney(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  particles: Particle[],
  time: number,
  pointer: { x: number; y: number; active: boolean },
  dark: boolean,
  reducedMotion: boolean,
) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  context.clearRect(0, 0, width, height);
  context.globalCompositeOperation = dark ? "screen" : "source-over";

  const base = dark ? "238,240,246" : "66,75,91";
  const accent = dark ? "255,103,112" : "231,70,82";
  const drift = reducedMotion ? 0 : time * 0.00055;
  const pointerRadius = Math.min(width, height) * 0.12;

  for (let index = 0; index < particles.length; index += 1) {
    const particle = particles[index];
    const orbit = reducedMotion ? 0 : 2.2 + particle.size * 0.7;
    const [animatedX, animatedY] = animatedHumanTarget(particle, width, height, time, reducedMotion);
    let x = animatedX + Math.sin(drift * particle.speed + particle.phase) * orbit;
    let y = animatedY + Math.cos(drift * particle.speed * 0.83 + particle.phase) * orbit;
    if (pointer.active) {
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance < pointerRadius) {
        const force = (1 - distance / pointerRadius) * 23;
        x += (dx / distance) * force;
        y += (dy / distance) * force;
      }
    }
    particle.x += (x - particle.x) * (reducedMotion ? 1 : 0.085);
    particle.y += (y - particle.y) * (reducedMotion ? 1 : 0.085);

    const pulse = reducedMotion ? 0.72 : 0.52 + Math.sin(drift * 2 + particle.phase) * 0.2;
    context.beginPath();
    context.fillStyle = `rgba(${particle.accent ? accent : base},${Math.max(0.18, pulse)})`;
    context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    context.fill();

    if (index % 23 === 0) {
      context.beginPath();
      context.strokeStyle = `rgba(${particle.accent ? accent : base},${dark ? 0.13 : 0.08})`;
      context.moveTo(particle.x, particle.y);
      const neighbour = particles[(index + 7) % particles.length];
      context.lineTo(neighbour.x, neighbour.y);
      context.stroke();
    }
  }

  if (!reducedMotion) {
    const startX = width * (width < 768 ? 0.16 : 0.48);
    const startY = height * (width < 768 ? 0.58 : 0.75);
    const endX = width * (width < 768 ? 0.86 : 0.91);
    const endY = height * (width < 768 ? 0.52 : 0.27);
    for (let index = 0; index < (width < 768 ? 18 : 34); index += 1) {
      const progress = (time * 0.000055 * (0.8 + seeded(index) * 0.5) + index / 34) % 1;
      const curve = Math.sin(progress * Math.PI);
      const x = startX + (endX - startX) * progress;
      const y = startY + (endY - startY) * progress - curve * height * 0.16;
      context.beginPath();
      context.fillStyle = `rgba(${accent},${0.18 + curve * 0.6})`;
      context.arc(x, y, 1.1 + curve * 2.1, 0, Math.PI * 2);
      context.fill();
    }
  }
}

export function CareerTransformationHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof CanvasRenderingContext2D === "undefined") return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = { x: 0, y: 0, active: false };
    let particles: Particle[] = [];
    let frame = 0;
    let visible = true;

    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, width < 768 ? 1.35 : 1.75);
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = width < 768 ? 310 : Math.min(820, Math.max(560, Math.round(width * 0.58)));
      particles = Array.from({ length: count }, (_, index) => {
        const [tx, ty] = pointInHuman(index, count, width, height);
        return {
          x: tx + (seeded(index + 91) - 0.5) * Math.min(width, height) * 0.025,
          y: ty + (seeded(index + 113) - 0.5) * Math.min(width, height) * 0.025,
          tx,
          ty,
          size: 0.75 + seeded(index + 17) * 1.65,
          phase: seeded(index + 41) * Math.PI * 2,
          speed: 0.7 + seeded(index + 57) * 1.45,
          accent: seeded(index + 73) > 0.84,
          part: bodyPart(index, count),
        };
      });
      drawJourney(canvas, context, particles, 0, pointer, document.documentElement.classList.contains("dark"), motion.matches);
    };

    const render = (time: number) => {
      if (visible) {
        drawJourney(canvas, context, particles, time, pointer, document.documentElement.classList.contains("dark"), motion.matches);
      }
      frame = window.requestAnimationFrame(render);
    };
    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointer.x = event.clientX - bounds.left;
      pointer.y = event.clientY - bounds.top;
      pointer.active = true;
    };
    const onPointerLeave = () => { pointer.active = false; };
    const observer = new ResizeObserver(resize);
    const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0.02 });
    const theme = new MutationObserver(() => resize());
    observer.observe(canvas);
    visibility.observe(canvas);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    canvas.addEventListener("pointermove", onPointerMove, { passive: true });
    canvas.addEventListener("pointerleave", onPointerLeave);
    resize();
    frame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      visibility.disconnect();
      theme.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return (
    <figure
      id="career-transformation"
      className="career-journey-visual career-data-universe"
      data-motion="full-body"
      role="img"
      aria-label="Световой поток данных собирается в человека и ведёт его через уровни Junior, Middle и Senior к принятому оферу"
    >
      <svg className="career-flow-map" viewBox="0 0 1440 860" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="career-flow-gradient" x1="0" x2="1">
            <stop offset="0" stopColor="#99a2b2" stopOpacity="0.05" />
            <stop offset="0.48" stopColor="#ef6c76" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ef5560" stopOpacity="0.72" />
          </linearGradient>
          <filter id="career-flow-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path className="career-flow-ribbon" d="M600 690 C735 805 935 766 925 608 C913 426 1110 452 1265 256" />
        <path className="career-flow-line" d="M600 690 C735 805 935 766 925 608 C913 426 1110 452 1265 256" />
        <path className="career-flow-pulse" d="M600 690 C735 805 935 766 925 608 C913 426 1110 452 1265 256" />
      </svg>
      <canvas ref={canvasRef} className="career-particle-canvas" aria-hidden="true" />
      <span className="career-data-aurora" aria-hidden="true" />
      <span className="career-orbit career-orbit-one" aria-hidden="true" />
      <span className="career-orbit career-orbit-two" aria-hidden="true" />
      <span className="career-stream-card career-stream-card-one" aria-hidden="true">SQL</span>
      <span className="career-stream-card career-stream-card-two" aria-hidden="true">HH</span>
      <span className="career-stream-card career-stream-card-three" aria-hidden="true">AI</span>
      <span className="career-journey-shade" aria-hidden="true" />
      <span className="career-journey-source"><Database size={13} /> вакансии становятся маршрутом</span>
      <span className="career-stage-node career-stage-junior">Junior <small>старт</small></span>
      <span className="career-stage-node career-stage-middle">Middle <small>рост</small></span>
      <span className="career-stage-node career-stage-senior">Senior <small>выбор</small></span>
      <span className="career-journey-offer">
        <span className="career-journey-offer-rings" aria-hidden="true" />
        <span className="career-journey-offer-icon"><BadgeCheck size={18} /></span>
        <span className="career-offer-copy"><small>Финиш маршрута</small><strong>Офер принят</strong></span>
        <Sparkles className="career-offer-spark" size={15} aria-hidden="true" />
      </span>
    </figure>
  );
}
