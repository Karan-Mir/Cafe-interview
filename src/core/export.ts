import type { Session } from "./types";
import { db } from "./db";

function download(name: string, text: string, type = "application/json") {
  const blob = new Blob([text], { type: type + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** SPEC 5 -- a session is only marked exported once the write resolves. */
export async function exportSession(s: Session) {
  const { ...body } = s;
  download(`session-${s.session_id.slice(0, 8)}.json`, JSON.stringify(body, null, 1));
  const stamped = { ...s, exported_at: new Date().toISOString() };
  await db.sessions.put(stamped);
  return stamped;
}

export async function exportAll(sessions: Session[]) {
  download(`qahvesanj-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(sessions, null, 1));
  const now = new Date().toISOString();
  await db.transaction("rw", db.sessions, async () => {
    for (const s of sessions) await db.sessions.put({ ...s, exported_at: now });
  });
}
