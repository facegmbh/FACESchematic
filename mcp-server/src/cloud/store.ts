/**
 * The backend's only persistent state: who signed in (with their Odoo API key, encrypted)
 * and the browser sessions. Drawings are NOT here — they live in Odoo.
 *
 * Session ids are stored as SHA-256 hashes, so a copy of this file opens no live session. The API keys are AES-256-GCM encrypted with a key derived from
 * FACE_SECRET; changing that secret signs everybody out.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface UserRecord {
  uid: number;
  login: string;
  name: string;
  apiKeyEnc: string;
  updatedAt: number;
}

export interface SessionRecord {
  uid: number;
  createdAt: number;
  expiresAt: number;
}

interface Persisted {
  users: Record<string, UserRecord>;
  sessions: Record<string, SessionRecord>;
}

export const hashId = (id: string) => crypto.createHash("sha256").update(id).digest("base64url");
export const newId = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");

export class Store {
  private data: Persisted = { users: {}, sessions: {} };
  private readonly file: string;
  private readonly key: Buffer;

  constructor(dataDir: string, secret: string) {
    this.file = path.join(dataDir, "store.json");
    this.key = crypto.scryptSync(secret, "faceschematic-backend-v1", 32);
    try {
      this.data = { ...this.data, ...JSON.parse(fs.readFileSync(this.file, "utf8")) };
    } catch {
      /* first run */
    }
    this.prune();
    setInterval(() => this.prune(), 6 * 3600 * 1000).unref();
  }

  // --- persistence -----------------------------------------------------------

  /** Written straight away: sign-ins are rare, and a restart must find every session. */
  save(): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }

  private prune(): void {
    const now = Date.now();
    let changed = false;
    for (const [k, s] of Object.entries(this.data.sessions)) {
      if (s.expiresAt < now) {
        delete this.data.sessions[k];
        changed = true;
      }
    }
    if (changed) this.save();
  }

  // --- API key encryption ----------------------------------------------------

  encrypt(text: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.key, iv);
    const ct = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
  }

  decrypt(b64: string): string {
    const raw = Buffer.from(b64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", this.key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  }

  // --- users -----------------------------------------------------------------

  /** The latest key a user signed in with wins. */
  putUser(uid: number, login: string, name: string, apiKey: string): UserRecord {
    const user: UserRecord = { uid, login, name, apiKeyEnc: this.encrypt(apiKey), updatedAt: Date.now() };
    this.data.users[String(uid)] = user;
    this.save();
    return user;
  }

  user(uid: number): UserRecord | undefined {
    return this.data.users[String(uid)];
  }

  // --- browser sessions --------------------------------------------------------

  createSession(uid: number, ttlMs: number): string {
    const id = newId();
    this.data.sessions[hashId(id)] = { uid, createdAt: Date.now(), expiresAt: Date.now() + ttlMs };
    this.save();
    return id;
  }

  session(id: string | undefined): SessionRecord | undefined {
    if (!id) return undefined;
    const s = this.data.sessions[hashId(id)];
    return s && s.expiresAt > Date.now() ? s : undefined;
  }

  deleteSession(id: string): void {
    delete this.data.sessions[hashId(id)];
    this.save();
  }
}
