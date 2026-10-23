/**
 * Who has which drawing open: one editor (the lock) and any number of readers
 * (SPEC-odoo-drawings.md). Tabs keep their entry alive with a heartbeat every 30 s; an entry
 * without one for 90 s is gone — a closed, crashed or offline tab lets go by itself.
 *
 * Held in memory only: a restart forgets everything, and each open tab takes its place
 * back with its next heartbeat.
 */

export const PRESENCE_TTL_MS = 90 * 1000;

interface Entry {
  uid: number;
  name: string;
  tabId: string;
  since: number;
  lastSeen: number;
}

export interface Holder {
  uid: number;
  name: string;
  since: number;
}

export type LockResult = { ok: true } | { ok: false; holder: Holder; sameUser: boolean };

export class Presence {
  private readonly editors = new Map<number, Entry>();
  private readonly readers = new Map<number, Map<string, Entry>>();

  constructor(private readonly now: () => number = Date.now) {}

  private alive(e: Entry | undefined): e is Entry {
    return !!e && this.now() - e.lastSeen <= PRESENCE_TTL_MS;
  }

  private editor(drawingId: number): Entry | undefined {
    const e = this.editors.get(drawingId);
    if (this.alive(e)) return e;
    this.editors.delete(drawingId);
    return undefined;
  }

  /** Take or refresh the lock. Another tab of the same user may take it over; nobody else may.
   *  A tab is a tab of one user: the same tab id under someone else (signed out and in again)
   *  counts as somebody else. */
  lock(drawingId: number, uid: number, name: string, tabId: string, takeOver = false): LockResult {
    const current = this.editor(drawingId);
    if (current && (current.tabId !== tabId || current.uid !== uid)) {
      const sameUser = current.uid === uid;
      if (!(sameUser && takeOver)) {
        return { ok: false, holder: { uid: current.uid, name: current.name, since: current.since }, sameUser };
      }
    }
    const since = current?.tabId === tabId && current.uid === uid ? current.since : this.now();
    this.editors.set(drawingId, { uid, name, tabId, since, lastSeen: this.now() });
    this.readers.get(drawingId)?.delete(tabId);
    return { ok: true };
  }

  /** Heartbeat of a tab that only reads. */
  view(drawingId: number, uid: number, name: string, tabId: string): void {
    if (this.holds(drawingId, uid, tabId)) return;
    let tabs = this.readers.get(drawingId);
    if (!tabs) this.readers.set(drawingId, (tabs = new Map()));
    const since = tabs.get(tabId)?.since ?? this.now();
    tabs.set(tabId, { uid, name, tabId, since, lastSeen: this.now() });
  }

  release(drawingId: number, uid: number, tabId: string): void {
    if (this.holds(drawingId, uid, tabId)) this.editors.delete(drawingId);
    const reader = this.readers.get(drawingId)?.get(tabId);
    if (reader?.uid === uid) this.readers.get(drawingId)!.delete(tabId);
  }

  /** Whether this tab already has the drawing open (as editor or reader) — it was checked then. */
  knows(drawingId: number, uid: number, tabId: string): boolean {
    if (this.holds(drawingId, uid, tabId)) return true;
    const reader = this.readers.get(drawingId)?.get(tabId);
    return this.alive(reader) && reader.uid === uid;
  }

  holds(drawingId: number, uid: number, tabId: string): boolean {
    const e = this.editor(drawingId);
    return e?.tabId === tabId && e.uid === uid;
  }

  holder(drawingId: number): Holder | null {
    const e = this.editor(drawingId);
    return e ? { uid: e.uid, name: e.name, since: e.since } : null;
  }

  /** Names of the other users reading the drawing right now. */
  viewers(drawingId: number, exceptUid: number): string[] {
    const tabs = this.readers.get(drawingId);
    if (!tabs) return [];
    const names = new Set<string>();
    for (const [tabId, e] of tabs) {
      if (!this.alive(e)) tabs.delete(tabId);
      else if (e.uid !== exceptUid) names.add(e.name);
    }
    return [...names].sort();
  }
}
