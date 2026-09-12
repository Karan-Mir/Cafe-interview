import Dexie, { type Table } from "dexie";
import type { Session } from "./types";

/** SPEC 0.5 -- nothing is ever deleted from the device without an explicit export
 *  first. A lost session is an hour of fieldwork and a café you cannot ask twice. */
class QzDb extends Dexie {
  sessions!: Table<Session, string>;
  audio!: Table<{ id: string; blob: Blob }, string>;
  constructor() {
    super("qahvesanj");
    this.version(1).stores({ sessions: "session_id, started_at, exported_at" });
    this.version(2).stores({
      sessions: "session_id, started_at, exported_at",
      audio: "id",
    });
    this.version(3).stores({
      sessions: "session_id, started_at, exported_at, synced_at",
      audio: "id",
    }).upgrade((tx) => tx.table("sessions").toCollection()
        .modify((s) => { if (s.synced_at === undefined) s.synced_at = null; }));
  }
}

export const db = new QzDb();

export async function putSession(s: Session) {
  await db.sessions.put(s);
}

export async function allSessions(): Promise<Session[]> {
  return db.sessions.orderBy("started_at").toArray();
}

export async function unfinished(): Promise<Session | undefined> {
  const all = await db.sessions.toArray();
  return all.find((s) => !s.finished_at);
}
