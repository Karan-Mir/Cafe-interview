import { useState } from "react";
import { useSession } from "../core/store";
import { COPY } from "../content/items";
import { CoffeeSculpture } from "../ui/CoffeeSculpture";

/** SPEC 2.0 -- one screen, one button, nothing else. Consent is a line UNDER the
 *  button, not a wall. If they uncheck it the session still runs. */
export default function M00Open() {
  const goto = useSession((s) => s.goto);
  const patch = useSession((s) => s.patch);
  const consent = useSession((s) => s.session?.consent.analysis ?? true);
  const [more, setMore] = useState(false);

  return (
    <div className="screen welcome-screen" style={{ justifyContent: "center" }}>
      <CoffeeSculpture />
      <div className="welcome-copy">
      <h1>{COPY.openTitle}</h1>
      <p style={{ fontSize: "1.35rem" }}>{COPY.openLine1}</p>
      <p style={{ fontSize: "1.35rem" }} className="muted">{COPY.openLine2}</p>
      </div>

      <div className="foot" style={{ flexDirection: "column", alignItems: "stretch" }}>
        <button className="btn primary" style={{ minHeight: 72, fontSize: "1.3rem" }}
                onClick={() => goto("profile", 0)}>
          {COPY.openStart}
        </button>

        <label style={{ display: "flex", gap: ".6rem", alignItems: "flex-start",
                        marginTop: "1rem", fontSize: "1rem" }}>
          <input type="checkbox" checked={consent} style={{ width: 26, height: 26, marginTop: 2 }}
                 onChange={(e) => patch((s) => { s.consent.analysis = e.target.checked; })} />
          <span>{COPY.consent}</span>
        </label>
        <button className="btn quiet" onClick={() => setMore((v) => !v)}>{COPY.consentMore}</button>
        {more && <p className="small muted">{COPY.consentBody}</p>}
      </div>
    </div>
  );
}
