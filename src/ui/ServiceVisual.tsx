import type { ServiceVisualKind } from "../content/items";

/** Small, local vector scenes for quickly scanning the MaxDiff services. */
export default function ServiceVisual({ kind }: { kind: ServiceVisualKind }) {
  const art = (() => {
    switch (kind) {
      case "report": return <><path d="M23 48V34m13 14V25m13 23V17"/><path d="M17 54h39"/><circle cx="50" cy="15" r="3"/></>;
      case "alert": return <><path d="M36 14 57 52H15Z"/><path d="M36 28v10m0 7v1"/><path d="M19 57h34"/></>;
      case "menu": return <><path d="M20 15h32v42H20z"/><path d="M27 25h18M27 34h12M27 43h15"/><path d="m45 45 4 4 8-10"/></>;
      case "calendar": return <><rect x="16" y="19" width="40" height="36" rx="6"/><path d="M16 29h40M26 14v10m20-10v10"/><path d="m29 43 5 5 10-12"/></>;
      case "stock": return <><path d="m15 28 21-12 21 12-21 12z"/><path d="M15 28v23l21 12 21-12V28M36 40v23"/><path d="M28 21 49 33"/></>;
      case "waste": return <><path d="M23 25h27l-2 34H25zM20 25h33M30 20h13"/><path d="M31 34v16m11-16v16"/><circle cx="53" cy="18" r="7"/><path d="m58 23 5 5"/></>;
      case "invoice": return <><path d="M21 14h31v45l-5-3-5 3-5-3-5 3-5-3-6 3z"/><path d="M28 26h17M28 35h17M28 44h10"/><circle cx="51" cy="49" r="8"/><path d="m57 55 5 5"/></>;
      case "social": return <><rect x="23" y="12" width="28" height="49" rx="7"/><circle cx="37" cy="35" r="8"/><circle cx="45" cy="26" r="2"/><path d="M30 55h14M16 24l3 2-3 2m42 10 3 2-3 2"/></>;
      case "chat": return <><path d="M14 20h43v29H35L23 58v-9h-9z"/><path d="M24 31h23M24 39h15"/><circle cx="52" cy="53" r="8"/><path d="m48 53 3 3 5-7"/></>;
      case "compare": return <><path d="M16 54V35m12 19V25m12 29V31m12 23V16"/><path d="M12 58h47"/><path d="m18 25 10-7 12 5 12-12"/></>;
      case "loyalty": return <><path d="M36 57S16 45 16 29c0-11 14-14 20-4 6-10 20-7 20 4 0 16-20 28-20 28Z"/><circle cx="36" cy="31" r="5"/><path d="M27 45c2-7 16-7 18 0"/></>;
      case "clock": return <><circle cx="36" cy="36" r="22"/><path d="M36 22v15l10 6"/><path d="m19 56 9-9m-9 9h8m-8 0v-8"/></>;
      case "checklist": return <><rect x="19" y="16" width="36" height="44" rx="5"/><path d="M29 15v7h16v-7"/><path d="m26 34 3 3 5-6m6 4h8m-22 12 3 3 5-6m6 4h8"/></>;
      case "assistant": return <><path d="M15 19h42v30H36L24 58v-9h-9z"/><path d="M27 35h18"/><path d="m50 13 2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></>;
    }
  })();

  return <span className="service-visual" aria-hidden="true">
    <svg viewBox="0 0 72 72" fill="none">
      <circle cx="36" cy="36" r="33" className="service-visual-halo" />
      <g stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">{art}</g>
    </svg>
  </span>;
}
