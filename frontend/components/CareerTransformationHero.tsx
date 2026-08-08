import Image from "next/image";
import { BadgeCheck, Database } from "lucide-react";

export function CareerTransformationHero() {
  return (
    <figure
      id="career-transformation"
      className="career-journey-visual"
      role="img"
      aria-label="Кандидат идёт по световому маршруту из данных HeadHunter к принятому оферу"
    >
      <Image
        className="career-journey-image career-journey-image-desktop"
        src="/media/career-journey-light-v2.png"
        alt=""
        fill
        priority
        sizes="(max-width: 767px) 0px, 100vw"
      />
      <Image
        className="career-journey-image career-journey-image-mobile"
        src="/media/career-journey-mobile-light-v2.png"
        alt=""
        fill
        priority
        sizes="(max-width: 767px) 100vw, 0px"
      />
      <span className="career-journey-shade" aria-hidden="true" />
      <span className="career-journey-source"><Database size={13} /> данные HH превращаются в маршрут</span>
      <span className="career-journey-offer">
        <span className="career-journey-offer-icon"><BadgeCheck size={18} /></span>
        <span><small>Финиш маршрута</small><strong>Офер принят</strong></span>
      </span>
    </figure>
  );
}
