"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CareerPlanetScene = dynamic(
  () => import("@/components/CareerPlanetScene").then((module) => module.CareerPlanetScene),
  { ssr: false },
);

export function CareerTransformationHero() {
  const [sceneReady, setSceneReady] = useState(false);
  const [dark, setDark] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

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
      data-motion="segmented-planet-core-journey"
      role="img"
      aria-label="Трёхмерный человек проходит по планете этапы Подготовка, Проекты и Интервью; отдельные плиты планеты поднимаются и открывают офер в светящемся ядре"
    >
      <div className="career-3d-planet-stage" aria-hidden="true">
        {sceneReady ? (
          <CareerPlanetScene dark={dark} reducedMotion={reducedMotion} />
        ) : (
          <div className="career-3d-planet-fallback">
            <span /><span /><span /><span /><span /><span />
          </div>
        )}

        <div className="career-3d-stage-sign career-3d-stage-sign-one">
          <span>Подготовка</span>
        </div>
        <div className="career-3d-stage-sign career-3d-stage-sign-two">
          <span>Проекты</span>
        </div>
        <div className="career-3d-stage-sign career-3d-stage-sign-three">
          <span>Интервью</span>
        </div>

        <div className="career-3d-core-offer" data-testid="career-planet-core">
          <span className="career-3d-core-check">✓</span>
          <span><small>В центре маршрута</small><strong>Офер</strong></span>
        </div>
      </div>
      <span className="career-journey-shade" aria-hidden="true" />
      <span className="sr-only">Подготовка · Проекты · Интервью · Офер</span>
    </figure>
  );
}
