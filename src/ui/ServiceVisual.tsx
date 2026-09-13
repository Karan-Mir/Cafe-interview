import type { ServiceVisualKind } from "../content/items";

/** Locally hosted artwork, included in the offline app cache. */
export default function ServiceVisual({ kind }: { kind: ServiceVisualKind }) {
  return <span className="service-artwork" aria-hidden="true">
    <img src={`${import.meta.env.BASE_URL}images/services/${kind}.webp`}
      width="768" height="512" alt="" decoding="async" />
  </span>;
}
