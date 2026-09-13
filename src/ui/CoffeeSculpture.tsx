import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/** Decorative 3D-style sculpture, choreographed locally and independent of survey state. */
export function CoffeeSculpture() {
  const scene = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add({ motion: "(prefers-reduced-motion: no-preference)" }, ({ conditions }) => {
      if (!conditions?.motion) return;
      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro.from(".coffee-object", { y: 34, rotation: -15, autoAlpha: 0, duration: .75 })
        .from(".scene-orbit", { scale: .78, autoAlpha: 0, duration: .6 }, "<.08")
        .from(".coffee-bean", { y: 18, rotation: -20, autoAlpha: 0, duration: .4, stagger: .08 }, "<.12")
        .from(".scene-caption", { autoAlpha: 0, y: 6, duration: .35 }, "<");
      gsap.to(".coffee-object", { y: -11, rotation: -6, duration: 3.4, ease: "sine.inOut", repeat: -1, yoyo: true, delay: .7 });
      gsap.to(".steam i", { y: -17, scaleX: 1.18, autoAlpha: .6, duration: 2.2, ease: "sine.inOut", repeat: -1, yoyo: true, stagger: .45 });
    });
    return () => mm.revert();
  }, { scope: scene });

  return <div ref={scene} className="coffee-scene" aria-hidden="true">
    <div className="scene-orbit orbit-one" /><div className="scene-orbit orbit-two" />
    <div className="coffee-object">
      <div className="coffee-shadow" /><div className="saucer" />
      <div className="cup-handle" /><div className="cup-body"><span className="cup-seal">ق</span></div>
      <div className="cup-rim"><div className="coffee-liquid"><i /><i /><i /></div></div>
      <div className="steam"><i /><i /><i /></div>
    </div>
    <span className="coffee-bean bean-one" /><span className="coffee-bean bean-two" />
    <span className="scene-caption">قهوه‌سنج · رشت</span>
  </div>;
}
