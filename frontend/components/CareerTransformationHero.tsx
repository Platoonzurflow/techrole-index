"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CareerPlanetScene = dynamic(
  () => import("@/components/CareerPlanetScene").then((module) => module.CareerPlanetScene),
  { ssr: false },
);

function JourneyArrow({ label, position }: { label: string; position: "one" | "two" | "three" }) {
  return (
    <div className={`career-3d-stage-arrow career-3d-stage-arrow-${position}`}>
      <svg viewBox="0 0 190 82" aria-hidden="true">
        <path className="career-3d-stage-arrow-shadow" d="M9 58 C43 9 119 8 174 52" />
        <path className="career-3d-stage-arrow-line" pathLength="100" d="M9 58 C43 9 119 8 174 52" />
        <path className="career-3d-stage-arrow-head" d="m155 37 20 15-23 7" />
      </svg>
      <span className="career-3d-stage-thread" />
      <span className="career-3d-stage-note">
        <span>{label}</span>
      </span>
    </div>
  );
}

export function CareerTransformationHero() {
  const [sceneReady, setSceneReady] = useState(false);
  const [dark, setDark] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [planetInteracting, setPlanetInteracting] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const syncTheme = () => setDark(document.documentElement.classList.contains("dark"));
    const syncMotion = () => setReducedMotion(Boolean(motion?.matches));
    const themeObserver = new MutationObserver(syncTheme);
    let idleId: number | undefined;
    let fallbackTimer: number | undefined;
    const enableScene = () => {
      setSceneReady(
        typeof window.WebGLRenderingContext !== "undefined"
        || typeof window.WebGL2RenderingContext !== "undefined",
      );
    };
    const frame = window.requestAnimationFrame(() => {
      syncTheme();
      syncMotion();
      fallbackTimer = window.setTimeout(() => {
        if (typeof window.requestIdleCallback === "function") {
          idleId = window.requestIdleCallback(enableScene, { timeout: 1200 });
        } else {
          enableScene();
        }
      }, 1600);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    motion?.addEventListener?.("change", syncMotion);
    return () => {
      window.cancelAnimationFrame(frame);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
      themeObserver.disconnect();
      motion?.removeEventListener?.("change", syncMotion);
    };
  }, []);

  return (
    <figure
      id="career-transformation"
      className="career-journey-visual career-planet-universe career-planet-3d-universe"
      data-motion="interactive-brand-planet-journey"
      data-interacting={planetInteracting ? "true" : "false"}
      role="img"
      aria-label="Интерактивная планета показывает путь через этапы Подготовка, Проекты и Интервью; при наведении отдельные плиты раскрывают светящееся ядро с офером"
    >
      <div className="career-3d-planet-stage" aria-hidden="true">
        {sceneReady ? (
          <CareerPlanetScene
            dark={dark}
            reducedMotion={reducedMotion}
            onInteractionChange={setPlanetInteracting}
          />
        ) : (
          <div className="career-3d-planet-fallback">
            <span /><span /><span /><span /><span /><span />
          </div>
        )}

        <JourneyArrow label="Подготовка" position="one" />
        <JourneyArrow label="Проекты" position="two" />
        <JourneyArrow label="Интервью" position="three" />

        <div className="career-3d-core-engraving" data-testid="career-planet-core">
          Офер
        </div>
      </div>
      <span className="career-journey-shade" aria-hidden="true" />
      <span className="sr-only">Подготовка · Проекты · Интервью · Офер</span>
    </figure>
  );
}
