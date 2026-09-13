import { useEffect, useState } from "react";
import DialogOverlay from "./DialogOverlay";

/**
 * SPEC 2.4 -- the three packages have to be visible AT ONCE. Measured on a
 * 375x812 phone in portrait they stack to 474/448/507 px and the third one sits
 * 975 px below the fold: the owner scrolls, forms a view of package one, and
 * picks the first acceptable option instead of trading off. That is satisficing,
 * and it is precisely the bias the conjoint exists to remove.
 *
 * Landscape gives three columns that fit. This is the only screen that needs it.
 */
export default function RotateHint() {
  const [portrait, setPortrait] = useState(false);

  useEffect(() => {
    const check = () => setPortrait(window.innerWidth < 760 && window.innerHeight > window.innerWidth);
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  // Portrait now has a purpose-built comparison matrix. Keep this hint only for
  // exceptionally narrow devices where three readable columns cannot fit.
  if (!portrait || window.innerWidth >= 340) return null;

  return (
    <DialogOverlay alert title="گوشی را بچرخان">
      <div style={{ fontSize: "3.5rem", lineHeight: 1 }} aria-hidden>⟳</div>
      <p className="muted" style={{ maxWidth: "22rem" }}>
        این صفحه سه بسته را کنار هم نشان می‌دهد. برای اینکه بتوانی هر سه را با هم
        ببینی و مقایسه کنی، گوشی را افقی بگیر.
      </p>
    </DialogOverlay>
  );
}
