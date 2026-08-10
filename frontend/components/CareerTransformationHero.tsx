"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const loadCareerPlanetScene = () => import("@/components/CareerPlanetScene")
  .then((module) => module.CareerPlanetScene);
const CareerPlanetScene = dynamic(
  loadCareerPlanetScene,
  { ssr: false },
);

function JourneyFlag({ anchorIndex, label, position }: {
  anchorIndex: number;
  label: string;
  position: "one" | "two" | "three";
}) {
  return (
    <div
      className={`career-3d-stage-flag career-3d-stage-flag-${position}`}
      data-flag-anchor={anchorIndex}
    >
      <span className="career-3d-flag-pole">
        <span className="career-3d-flag-finial" />
        <span className="career-3d-flag-collar" />
        <span className="career-3d-flag-base" />
      </span>
      <span className="career-3d-flag-banner">
        <span className="career-3d-flag-label">{label}</span>
        <span className="career-3d-flag-fold" />
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
    const enableScene = () => {
      const webglAvailable = typeof window.WebGLRenderingContext !== "undefined"
        || typeof window.WebGL2RenderingContext !== "undefined";
      if (webglAvailable) {
        void loadCareerPlanetScene();
        setSceneReady(true);
      }
    };
    const frame = window.requestAnimationFrame(() => {
      syncTheme();
      syncMotion();
      enableScene();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    motion?.addEventListener?.("change", syncMotion);
    return () => {
      window.cancelAnimationFrame(frame);
      themeObserver.disconnect();
      motion?.removeEventListener?.("change", syncMotion);
    };
  }, []);

  return (
    <figure
      id="career-transformation"
      className="career-journey-visual career-planet-universe career-planet-3d-universe"
      data-motion="interactive-obsidian-flag-planet"
      data-interacting={planetInteracting ? "true" : "false"}
      data-scene-ready={sceneReady ? "true" : "false"}
      role="img"
      aria-label="Интерактивная планета с металлическими флагами Подготовка, Проекты и Интервью; при наведении отдельные плиты раскрывают обсидиановое ядро с золотой гравировкой Офер"
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

        {!sceneReady ? (
          <>
            <JourneyFlag anchorIndex={0} label="Подготовка" position="one" />
            <JourneyFlag anchorIndex={1} label="Проекты" position="two" />
            <JourneyFlag anchorIndex={2} label="Интервью" position="three" />
            <div className="career-3d-core-engraving" data-testid="career-planet-core">
              Офер
            </div>
          </>
        ) : null}
      </div>
      <span className="career-journey-shade" aria-hidden="true" />
      <span className="sr-only">Подготовка · Проекты · Интервью · Офер</span>
    </figure>
  );
}
