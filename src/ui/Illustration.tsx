import { useId } from "react";

export type IllustrationKind = "cafe" | "choices" | "coins" | "voice" | "report";

/** Local vector illustrations. Equal treatment across research alternatives. */
export function Illustration({ kind, small = false }: { kind: IllustrationKind; small?: boolean }) {
  const id = useId().replace(/:/g, "");
  return <svg className={`illustration${small ? " illustration-small" : ""}`} viewBox="0 0 240 180" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}paper`} x1="50" y1="20" x2="180" y2="155" gradientUnits="userSpaceOnUse"><stop stopColor="#fffdf0"/><stop offset="1" stopColor="#d0d9bb"/></linearGradient>
      <linearGradient id={`${id}green`} x1="70" y1="30" x2="160" y2="155" gradientUnits="userSpaceOnUse"><stop stopColor="#719174"/><stop offset="1" stopColor="#284c3a"/></linearGradient>
      <linearGradient id={`${id}gold`} x1="60" y1="40" x2="160" y2="150" gradientUnits="userSpaceOnUse"><stop stopColor="#f8e8b3"/><stop offset="1" stopColor="#b28a46"/></linearGradient>
    </defs>
    <ellipse cx="120" cy="157" rx="80" ry="12" fill="#244d3d" opacity=".08"/>
    <circle cx="120" cy="88" r="76" stroke="#aab893" strokeDasharray="3 8" opacity=".35"/>
    <g className="illustration-float" strokeWidth="2" strokeLinejoin="round">
      {kind === "cafe" && <>
        <path d="M62 77h116v74H62z" fill={`url(#${id}paper)`} stroke="#9aaa87"/>
        <path d="M55 76 70 42h100l15 34" fill={`url(#${id}green)`} stroke="#45634a"/>
        <path d="m81 43-8 32m32-32-3 32m33-32 3 32m18-32 10 32" stroke="#cfdbb9" strokeWidth="10"/>
        <path d="M55 76q13 17 26 0 13 17 26 0 13 17 26 0 13 17 26 0 13 17 26 0" fill="#6f8b60" stroke="#45634a"/>
        <path d="M78 99h35v31H78zM133 95h28v56h-28z" fill="#375441" stroke="#869b76"/>
        <path d="M96 100v29m-17-14h34" stroke="#d6dfc0"/><circle cx="154" cy="124" r="2" fill="#eed6a0"/>
        <path d="M47 151h146" stroke="#778f67" strokeWidth="5"/>
      </>}
      {kind === "choices" && <>
        <rect x="45" y="49" width="87" height="104" rx="12" transform="rotate(-12 45 49)" fill={`url(#${id}green)`}/>
        <rect x="103" y="30" width="87" height="110" rx="12" transform="rotate(12 103 30)" fill={`url(#${id}paper)`} stroke="#9caa87"/>
        <path d="m123 67 34 7m-38 12 46 10m-50 9 32 7" stroke="#8a9f76" strokeLinecap="round"/>
        <circle cx="84" cy="110" r="20" fill={`url(#${id}gold)`}/><path d="m75 110 6 6 12-14" stroke="#5b6442" strokeLinecap="round"/>
      </>}
      {kind === "coins" && <>{[0,1,2].map((n) => <g key={n} transform={`translate(${n*43} ${-n*15})`}>
        <path d="M48 110v19c0 18 53 18 53 0v-19" fill="#b49553" stroke="#aa8948"/>
        <ellipse cx="74.5" cy="110" rx="26.5" ry="13" fill={`url(#${id}gold)`} stroke="#b99b59"/>
        <ellipse cx="74.5" cy="110" rx="18" ry="8" stroke="#fff1c4"/><path d="M55 128v7m10-5v9m11-8v9m11-9v7" stroke="#dfbf75"/>
      </g>)}</>}
      {kind === "voice" && <>
        <rect x="96" y="34" width="48" height="79" rx="24" fill={`url(#${id}green)`} stroke="#456b4c"/>
        <path d="M83 87v9a37 37 0 0 0 74 0v-9m-37 46v17m-20 0h40" stroke="#9cae83" strokeWidth="6" strokeLinecap="round"/>
        <path d="M109 51h22m-22 12h22m-22 12h22" stroke="#c8d7b7" strokeLinecap="round"/>
        <path d="M64 69v35m-13-26v17m126-26v35m13-26v17" stroke="#b59b60" strokeWidth="4" strokeLinecap="round"/>
      </>}
      {kind === "report" && <>
        <rect x="69" y="33" width="111" height="120" rx="12" transform="rotate(7 69 33)" fill="#a4b494"/>
        <rect x="61" y="25" width="111" height="120" rx="12" fill={`url(#${id}paper)`} stroke="#abb799"/>
        <path d="M81 48h54m-54 11h34" stroke="#90a07d" strokeLinecap="round"/>
        <rect x="82" y="100" width="15" height="24" rx="4" fill="#bca46a"/><rect x="107" y="85" width="15" height="39" rx="4" fill="#8da780"/><rect x="132" y="73" width="15" height="51" rx="4" fill="#416d4d"/>
      </>}
    </g>
  </svg>;
}

export function SectionIntro({ kind, title, description, step }: { kind: IllustrationKind; title: string; description: string; step?: string }) {
  return <header className="section-intro"><div>{step && <div className="eyebrow">{step}</div>}<h2>{title}</h2><p className="helper">{description}</p></div><Illustration kind={kind}/></header>;
}
