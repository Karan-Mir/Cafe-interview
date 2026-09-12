/** Decorative CSS sculpture: bundled, offline, and independent of survey state. */
export function CoffeeSculpture() {
  return <div className="coffee-scene" aria-hidden="true">
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
