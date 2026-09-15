import Database from "better-sqlite3";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  randomUUID,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import type { Interview, Settings } from "../lib/contracts";
import { defaults, mergeSettings, redactSettings } from "./settings";
import { AppError, nonempty } from "./security";
type RecordData = Interview & {
  settingsSnapshot: Settings;
  version: number;
  question: string;
  questionSource: "guided" | "ollama";
  memoirSources: { fragmentId: string; revision: number }[];
  memoirSource?: string;
};
export class Repository {
  db: Database.Database;
  private secret: Buffer;
  constructor(
    public dir = process.env.MEMORY_DATA_DIR ?? join(process.cwd(), "data"),
  ) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    mkdirSync(join(dir, "media"), { recursive: true, mode: 0o700 });
    const keyPath = join(dir, ".encryption-key");
    try {
      this.secret = readFileSync(keyPath);
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
      const key = randomBytes(32);
      try {
        writeFileSync(keyPath, key, { flag: "wx", mode: 0o600 });
      } catch (e: any) {
        if (e.code !== "EEXIST") throw e;
      }
      this.secret = readFileSync(keyPath);
    }
    this.db = new Database(join(dir, "memory.sqlite"));
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 5000");
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS interviews(id TEXT PRIMARY KEY,owner TEXT NOT NULL,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings(owner TEXT PRIMARY KEY,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS turns(interview TEXT,request TEXT,PRIMARY KEY(interview,request)); CREATE TABLE IF NOT EXISTS generations(interview TEXT,kind TEXT,token TEXT,version INTEGER,PRIMARY KEY(interview,kind)); CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,owner TEXT,interview TEXT,path TEXT,mime TEXT);",
    );
  }
  close() {
    this.db.close();
  }
  private encrypt(value: unknown) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.secret, iv);
    const data = Buffer.concat([
      cipher.update(JSON.stringify(value)),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
  }
  private decrypt(value: string) {
    const b = Buffer.from(value, "base64"),
      decipher = createDecipheriv(
        "aes-256-gcm",
        this.secret,
        b.subarray(0, 12),
      );
    decipher.setAuthTag(b.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([
        decipher.update(b.subarray(28)),
        decipher.final(),
      ]).toString(),
    );
  }
  settings(owner: string, privateKeys = false): Settings {
    const row = this.db
      .prepare("SELECT data FROM settings WHERE owner=?")
      .get(owner) as any;
    const s = row ? this.decrypt(row.data) : structuredClone(defaults);
    return privateKeys ? s : redactSettings(s);
  }
  saveSettings(owner: string, patch: any) {
    const settings = mergeSettings(this.settings(owner, true), patch);
    this.db
      .prepare(
        "INSERT INTO settings VALUES (?,?) ON CONFLICT(owner) DO UPDATE SET data=excluded.data",
      )
      .run(owner, this.encrypt(settings));
    return redactSettings(settings);
  }
  raw(owner: string, id: string): RecordData {
    const row = this.db
      .prepare("SELECT data FROM interviews WHERE id=? AND owner=?")
      .get(id, owner) as any;
    if (!row) throw new AppError("기록을 찾을 수 없습니다.", 404);
    return this.decrypt(row.data);
  }
  get(owner: string, id: string) {
    const { settingsSnapshot, version, ...publicData } = this.raw(owner, id);
    return publicData;
  }
  list(owner: string) {
    return (
      this.db
        .prepare("SELECT id FROM interviews WHERE owner=? ORDER BY rowid DESC")
        .all(owner) as any[]
    ).map((r) => this.get(owner, r.id));
  }
  private persist(owner: string, row: RecordData) {
    this.db
      .prepare(
        "INSERT INTO interviews VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      )
      .run(row.id, owner, this.encrypt(row));
  }
  create(owner: string, photoUrl: string, isSample: boolean) {
    const now = new Date().toISOString();
    const row: RecordData = {
      id: randomUUID(),
      title: isSample ? "봄 소풍의 기억" : "사진 속 나의 이야기",
      photoUrl,
      isSample,
      stage: "interview",
      createdAt: now,
      updatedAt: now,
      fragments: [],
      postcardText: "",
      memoirText: "",
      memoirApproved: false,
      settingsSnapshot: this.settings(owner, true),
      version: 0,
      question: "이 사진을 보니 가장 먼저 어떤 기억이 떠오르세요?",
      questionSource: "guided",
      memoirSources: [],
    };
    this.persist(owner, row);
    return this.get(owner, row.id);
  }
  private change(owner: string, id: string, fn: (r: RecordData) => void) {
    return this.db.transaction(() => {
      const r = this.raw(owner, id);
      fn(r);
      r.updatedAt = new Date().toISOString();
      this.persist(owner, r);
      return this.get(owner, id);
    })();
  }
  addTurn(owner: string, id: string, text: string, requestId: string) {
    nonempty(text);
    nonempty(requestId, 128);
    return this.db.transaction(() => {
      this.raw(owner, id);
      const result = this.db
        .prepare("INSERT OR IGNORE INTO turns VALUES (?,?)")
        .run(id, requestId);
      if (!result.changes)
        return { interview: this.get(owner, id), duplicate: true };
      const interview = this.change(owner, id, (r) => {
        r.fragments.push({
          id: randomUUID(),
          original: text,
          text,
          revisions: [],
          createdAt: new Date().toISOString(),
        });
        r.version++;
        r.memoirApproved = false;
      });
      return { interview, duplicate: false };
    })();
  }
  revise(owner: string, id: string, fragmentId: string, text: string) {
    return this.change(owner, id, (r) => {
      const f = r.fragments.find((f) => f.id === fragmentId);
      if (!f) throw new AppError("원문 조각을 찾을 수 없습니다.", 404);
      f.text = nonempty(text);
      f.revisions.push(f.text);
      r.version++;
      r.memoirApproved = false;
    });
  }
  postcard(owner: string, id: string, text: string) {
    return this.change(owner, id, (r) => {
      if (!r.fragments.length) throw new AppError("먼저 이야기를 남겨 주세요.");
      r.postcardText = nonempty(text, 5000);
      r.stage = "postcard";
    });
  }
  approveMemoir(owner: string, id: string, text: string) {
    return this.change(owner, id, (r) => {
      if (!r.memoirText) throw new AppError("초안을 먼저 만들어 주세요.");
      if (
        r.memoirSources.length !== r.fragments.length ||
        r.memoirSources.some(
          (s) =>
            r.fragments.find((f) => f.id === s.fragmentId)?.revisions.length !==
            s.revision,
        )
      )
        throw new AppError(
          "원문이 바뀌었습니다. 초안을 다시 만들어 주세요.",
          409,
        );
      r.memoirText = nonempty(text, 20000);
      r.memoirApproved = true;
      r.stage = "memoir";
      r.version++;
    });
  }
  beginGeneration(owner: string, id: string, kind: string) {
    const r = this.raw(owner, id);
    const token = randomUUID();
    this.db
      .prepare(
        "INSERT INTO generations VALUES (?,?,?,?) ON CONFLICT(interview,kind) DO UPDATE SET token=excluded.token,version=excluded.version",
      )
      .run(id, kind, token, r.version);
    return token;
  }
  finishMemoir(
    owner: string,
    id: string,
    token: string,
    text: string,
    sources: RecordData["memoirSources"],
    source = "guided",
  ) {
    return this.finish(owner, id, "memoir", token, (r) => {
      r.memoirText = text;
      r.memoirApproved = false;
      r.memoirSources = sources;
      r.memoirSource = source;
      r.stage = "memoir";
    });
  }
  finishQuestion(
    owner: string,
    id: string,
    token: string,
    text: string,
    source: "guided" | "ollama",
  ) {
    return this.finish(owner, id, "question", token, (r) => {
      r.question = text;
      r.questionSource = source;
    });
  }
  private finish(
    owner: string,
    id: string,
    kind: string,
    token: string,
    fn: (r: RecordData) => void,
  ) {
    return this.db.transaction(() => {
      const g = this.db
        .prepare("SELECT * FROM generations WHERE interview=? AND kind=?")
        .get(id, kind) as any;
      let r: RecordData;
      try {
        r = this.raw(owner, id);
      } catch {
        return false;
      }
      if (!g || g.token !== token || g.version !== r.version) return false;
      fn(r);
      this.persist(owner, r);
      this.db
        .prepare("DELETE FROM generations WHERE interview=? AND kind=?")
        .run(id, kind);
      return true;
    })();
  }
  registerMedia(
    owner: string,
    id: string,
    path: string,
    mime: string,
    interview: string | null = null,
  ) {
    if (interview) this.raw(owner, interview);
    this.db
      .prepare("INSERT INTO media VALUES (?,?,?,?,?)")
      .run(id, owner, interview, path, mime);
  }
  attachMedia(owner: string, mediaId: string, interviewId: string) {
    this.raw(owner, interviewId);
    this.db
      .prepare("UPDATE media SET interview=? WHERE id=? AND owner=?")
      .run(interviewId, mediaId, owner);
  }
  media(owner: string, id: string) {
    const row = this.db
      .prepare("SELECT * FROM media WHERE id=? AND owner=?")
      .get(id, owner) as any;
    if (!row) throw new AppError("사진을 찾을 수 없습니다.", 404);
    return row as { id: string; path: string; mime: string; interview: string };
  }
  remove(owner: string, id: string) {
    return this.db.transaction(() => {
      this.raw(owner, id);
      const files = this.db
        .prepare("SELECT path FROM media WHERE interview=? AND owner=?")
        .all(id, owner) as { path: string }[];
      this.db
        .prepare("DELETE FROM media WHERE interview=? AND owner=?")
        .run(id, owner);
      this.db.prepare("DELETE FROM generations WHERE interview=?").run(id);
      this.db.prepare("DELETE FROM turns WHERE interview=?").run(id);
      this.db
        .prepare("DELETE FROM interviews WHERE id=? AND owner=?")
        .run(id, owner);
      return files;
    })();
  }
}
const globalRepo = globalThis as typeof globalThis & {
  memoryRepository?: Repository;
};
export function repository() {
  return (globalRepo.memoryRepository ??= new Repository());
}
