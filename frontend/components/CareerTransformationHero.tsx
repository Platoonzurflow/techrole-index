"use client";

import { useState } from "react";
import { Banknote, BadgeCheck, BriefcaseBusiness, Shirt } from "lucide-react";

export function CareerTransformationHero() {
  const [active, setActive] = useState(false);

  return (
    <button
      type="button"
      className={`career-scene ${active ? "is-active" : ""}`}
      aria-label="Показать карьерную трансформацию: деньги, деловой образ, сумка для ноутбука и офер"
      aria-pressed={active}
      onClick={() => setActive((current) => !current)}
    >
      <span className="scene-copy"><strong>Из поиска</strong><span>к первому оферу</span></span>
      <span className="scene-state scene-state-before">Ищу работу</span>
      <span className="scene-state scene-state-after">Вышел на новую работу</span>

      <span className="career-object career-money" aria-hidden="true">
        <span className="money-note money-note-1">₽</span>
        <span className="money-note money-note-2">₽</span>
        <span className="money-note money-note-3">₽</span>
        <span className="object-card"><Banknote size={30} /><small>Доход</small></span>
      </span>
      <span className="career-object career-jacket" aria-hidden="true">
        <span className="object-card"><Shirt size={30} /><small>Новый образ</small></span>
      </span>
      <span className="career-object career-bag" aria-hidden="true">
        <span className="object-card"><BriefcaseBusiness size={30} /><small>Рабочий сетап</small></span>
      </span>
      <span className="career-object career-offer" aria-hidden="true">
        <span className="offer-card"><BadgeCheck size={22} /><span><small>Статус</small><strong>Офер получен</strong></span></span>
      </span>

      <span className="candidate" aria-hidden="true">
        <span className="candidate-shadow" />
        <span className="candidate-chair"><span /></span>
        <span className="candidate-leg candidate-leg-left" />
        <span className="candidate-leg candidate-leg-right" />
        <span className="candidate-shoe candidate-shoe-left" />
        <span className="candidate-shoe candidate-shoe-right" />
        <span className="candidate-body">
          <span className="candidate-hood" />
          <span className="candidate-jacket-layer"><i /><i /></span>
          <span className="candidate-shirt"><i /></span>
          <span className="candidate-arm candidate-arm-left" />
          <span className="candidate-arm candidate-arm-right" />
          <span className="candidate-hand candidate-hand-left" />
          <span className="candidate-hand candidate-hand-right" />
        </span>
        <span className="candidate-neck" />
        <span className="candidate-head">
          <span className="candidate-hair" />
          <span className="candidate-ear" />
          <span className="candidate-face">
            <span className="candidate-brow candidate-brow-left" />
            <span className="candidate-brow candidate-brow-right" />
            <i /><i />
            <span className="candidate-nose" />
            <span className="candidate-cheek candidate-cheek-left" />
            <span className="candidate-cheek candidate-cheek-right" />
            <b />
          </span>
        </span>
        <span className="candidate-bag"><BriefcaseBusiness size={26} /></span>
      </span>

      <span className="scene-floor" aria-hidden="true" />
    </button>
  );
}
