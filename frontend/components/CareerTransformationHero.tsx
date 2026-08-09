"use client";

import { useEffect, useRef } from "react";

export function CareerTransformationHero() {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (
      !scene
      || (typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    ) return;

    let frame = 0;
    const onPointerMove = (event: PointerEvent) => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const bounds = scene.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        scene.style.setProperty("--planet-shift-x", `${x * 12}px`);
        scene.style.setProperty("--planet-shift-y", `${y * 9}px`);
      });
    };
    const resetPointer = () => {
      scene.style.setProperty("--planet-shift-x", "0px");
      scene.style.setProperty("--planet-shift-y", "0px");
    };

    scene.addEventListener("pointermove", onPointerMove, { passive: true });
    scene.addEventListener("pointerleave", resetPointer);
    return () => {
      window.cancelAnimationFrame(frame);
      scene.removeEventListener("pointermove", onPointerMove);
      scene.removeEventListener("pointerleave", resetPointer);
    };
  }, []);

  return (
    <figure
      id="career-transformation"
      className="career-journey-visual career-planet-universe"
      data-motion="planet-core-journey"
      role="img"
      aria-label="Человек идёт по планете через этапы Подготовка, Проекты и Интервью; планета раскрывается и показывает офер в ядре"
    >
      <div ref={sceneRef} className="career-planet-parallax">
        <svg
          className="career-planet-scene"
          viewBox="0 0 900 760"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="career-planet-surface" cx="34%" cy="24%" r="82%">
              <stop offset="0" className="career-planet-surface-light" />
              <stop offset="0.58" className="career-planet-surface-mid" />
              <stop offset="1" className="career-planet-surface-dark" />
            </radialGradient>
            <radialGradient id="career-planet-core" cx="48%" cy="42%" r="58%">
              <stop offset="0" stopColor="#fff7d9" />
              <stop offset="0.25" stopColor="#ffb86b" />
              <stop offset="0.64" stopColor="#ef5560" />
              <stop offset="1" stopColor="#8f2133" />
            </radialGradient>
            <linearGradient id="career-planet-route" x1="0" x2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity=".2" />
              <stop offset=".3" stopColor="#ffffff" stopOpacity=".95" />
              <stop offset="1" stopColor="#ff7982" />
            </linearGradient>
            <filter id="career-planet-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="18" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="career-planet-soft-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="24" stdDeviation="25" floodColor="#241e2b" floodOpacity=".28" />
            </filter>
            <clipPath id="career-planet-top-clip"><rect x="260" y="135" width="600" height="255" /></clipPath>
            <clipPath id="career-planet-bottom-clip"><rect x="260" y="390" width="600" height="265" /></clipPath>
            <g id="career-planet-body">
              <circle className="career-planet-sphere" cx="560" cy="390" r="225" fill="url(#career-planet-surface)" />
              <path className="career-planet-land career-planet-land-one" d="M383 290c35-45 72-74 112-90 24 8 34 23 28 43-7 20-38 20-38 41 1 22 47 22 38 59-7 27-37 35-66 25-41-13-70-34-74-78Z" />
              <path className="career-planet-land career-planet-land-two" d="M574 176c53 4 101 29 141 70 11 22-4 37-35 38-21 1-31 18-32 38-1 26-20 38-48 34-35-5-50-33-33-60 13-20 2-37-21-49-28-15-18-50 28-71Z" />
              <path className="career-planet-land career-planet-land-three" d="M457 474c25-34 63-44 101-24 22 12 30 38 55 43 39 8 68-25 91 4 17 21 4 56-21 75-48 36-108 53-171 41-42-8-67-36-61-74 4-24-12-41 6-65Z" />
              <path className="career-planet-contour" d="M359 378c60 13 111 2 148-32 43-40 85-40 126-4 45 39 95 42 150 9M369 443c53-18 102-14 147 13 55 34 118 37 189 9" />
            </g>
          </defs>

          <g className="career-planet-stars">
            <circle cx="312" cy="164" r="2" /><circle cx="812" cy="210" r="2.4" />
            <circle cx="748" cy="616" r="1.8" /><circle cx="295" cy="554" r="1.6" />
            <circle cx="690" cy="111" r="1.4" /><circle cx="426" cy="684" r="2.1" />
          </g>
          <ellipse className="career-planet-shadow" cx="560" cy="651" rx="206" ry="31" />
          <ellipse className="career-planet-orbit career-planet-orbit-back" cx="560" cy="390" rx="324" ry="100" />
          <circle className="career-planet-atmosphere" cx="560" cy="390" r="240" />

          <g className="career-planet-core" data-testid="career-planet-core">
            <circle className="career-planet-core-halo" cx="560" cy="390" r="146" filter="url(#career-planet-glow)" />
            <circle cx="560" cy="390" r="123" fill="url(#career-planet-core)" />
            <circle className="career-planet-core-ring" cx="560" cy="390" r="91" />
            <g className="career-planet-core-offer" transform="translate(477 350)">
              <rect width="166" height="80" rx="24" />
              <path d="M24 31l8 8 17-20" />
              <text x="104" y="33" textAnchor="middle">Офер</text>
              <text className="career-planet-core-caption" x="104" y="56" textAnchor="middle">в ядре</text>
            </g>
          </g>

          <g className="career-planet-shell career-planet-shell-bottom" clipPath="url(#career-planet-bottom-clip)" filter="url(#career-planet-soft-shadow)">
            <use href="#career-planet-body" />
          </g>
          <g className="career-planet-shell career-planet-shell-top" clipPath="url(#career-planet-top-clip)" filter="url(#career-planet-soft-shadow)">
            <use href="#career-planet-body" />
          </g>

          <path className="career-planet-route-base" d="M345 339C407 273 468 238 540 230c77-9 150 22 223 105" />
          <path className="career-planet-route-pulse" d="M345 339C407 273 468 238 540 230c77-9 150 22 223 105" />

          <g className="career-planet-stage career-planet-stage-one" transform="translate(411 248)">
            <path className="career-planet-sign-post" d="M0 20v65" />
            <rect x="-56" y="-17" width="112" height="46" rx="13" />
            <text y="12" textAnchor="middle">Подготовка</text>
          </g>
          <g className="career-planet-stage career-planet-stage-two" transform="translate(555 205)">
            <path className="career-planet-sign-post" d="M0 20v67" />
            <rect x="-47" y="-17" width="94" height="46" rx="13" />
            <text y="12" textAnchor="middle">Проекты</text>
          </g>
          <g className="career-planet-stage career-planet-stage-three" transform="translate(696 251)">
            <path className="career-planet-sign-post" d="M0 20v67" />
            <rect x="-56" y="-17" width="112" height="46" rx="13" />
            <text y="12" textAnchor="middle">Интервью</text>
          </g>

          <g className="career-planet-walker">
            <ellipse className="career-planet-walker-shadow" cx="0" cy="29" rx="22" ry="6" />
            <g className="career-planet-person">
              <circle className="career-planet-person-head" cx="0" cy="-34" r="13" />
              <path className="career-planet-person-body" d="M-13-20Q0-27 13-20L10 5Q0 11-10 5Z" />
              <path className="career-planet-person-limb career-planet-person-arm-one" d="M-10-15l-18 22" />
              <path className="career-planet-person-limb career-planet-person-arm-two" d="M10-15l18 22" />
              <path className="career-planet-person-limb career-planet-person-leg-one" d="M-6 4l-14 28" />
              <path className="career-planet-person-limb career-planet-person-leg-two" d="M6 4l15 28" />
            </g>
          </g>

          <g className="career-planet-sparks">
            <path d="M760 178v20m-10-10h20" /><path d="M332 225v14m-7-7h14" />
            <path d="M795 443v16m-8-8h16" /><circle cx="356" cy="500" r="5" />
          </g>
          <ellipse className="career-planet-orbit career-planet-orbit-front" cx="560" cy="390" rx="324" ry="100" />
        </svg>
      </div>
      <span className="career-journey-shade" aria-hidden="true" />
    </figure>
  );
}
