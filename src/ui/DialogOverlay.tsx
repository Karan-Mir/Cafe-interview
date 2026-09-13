import { useEffect, useId, useRef, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  title?: string;
  alert?: boolean;
  onEscape?: () => void;
};

/** Accessible full-screen sheet with focus containment and restoration. */
export default function DialogOverlay({ children, className = "", title, alert = false, onEscape }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const focusable = root?.querySelector<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])");
    (focusable ?? root)?.focus();

    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && escapeRef.current) { event.preventDefault(); escapeRef.current(); return; }
      if (event.key !== "Tab" || !root) return;
      const nodes = Array.from(root.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])"));
      if (!nodes.length) { event.preventDefault(); root.focus(); return; }
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, []);

  return (
    <div ref={ref} className={`overlay ${className}`.trim()} role={alert ? "alertdialog" : "dialog"}
         aria-modal="true" aria-labelledby={title ? titleId : undefined} tabIndex={-1}>
      {title && <h2 id={titleId}>{title}</h2>}
      {children}
    </div>
  );
}
