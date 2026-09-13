import { db } from "./db";

const LS_DEVICE = "qz.device";

export function deviceId(): string {
  return localStorage.getItem(LS_DEVICE) ?? "";
}

export function setDeviceId(value: string) {
  localStorage.setItem(LS_DEVICE, value.trim());
}

/** Finished sessions that have not yet been confirmed by the server. */
export async function pending() {
  return (await db.sessions.toArray()).filter((session) => session.finished_at && !session.synced_at);
}

export async function pendingCount(): Promise<number> {
  return (await pending()).length;
}
