import { readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { AppError, nonempty } from "./security";
import { Repository } from "./repository";
import { savePhoto } from "./media";
import { memoirDraft, nextQuestion } from "./providers";
export async function interviewRoute(
  req: Request,
  owner: string,
  parts: string[],
  repo: Repository,
): Promise<Response> {
  const id = parts[1],
    action = parts[2];
  if (!id) {
    if (req.method === "GET")
      return Response.json({ interviews: repo.list(owner) });
    if (req.method === "POST") {
      let sample = false,
        consent = false,
        file: File | null = null;
      if (req.headers.get("content-type")?.includes("application/json")) {
        const b = await req.json();
        sample = b.sample === true;
        consent = b.consent === true;
      } else {
        const b = await req.formData();
        sample = b.get("sample") === "true";
        consent = b.get("consent") === "true";
        const value = b.get("photo");
        if (value instanceof File) file = value;
      }
      if (!consent) throw new AppError("기록 처리 안내에 동의해 주세요.");
      if (!sample && !file) throw new AppError("사진을 선택해 주세요.");
      const bytes = sample
        ? await readFile(
            join(process.cwd(), "public/samples/spring-picnic.png"),
          )
        : Buffer.from(await file!.arrayBuffer());
      const media = await savePhoto(repo, owner, bytes);
      const interview = repo.create(owner, media.url, sample);
      repo.attachMedia(owner, media.id, interview.id);
      return Response.json({ interview }, { status: 201 });
    }
  }
  if (id && !action) {
    if (req.method === "GET")
      return Response.json({ interview: repo.get(owner, id) });
    if (req.method === "DELETE") {
      const files = repo.remove(owner, id);
      await Promise.all(
        files.map(async (f) => {
          try {
            await unlink(f.path);
          } catch (e: any) {
            if (e.code !== "ENOENT") throw e;
          }
        }),
      );
      return Response.json({ ok: true });
    }
  }
  repo.get(owner, id);
  const b = await req.json();
  if (action === "turns" && req.method === "POST") {
    const result = repo.addTurn(
      owner,
      id,
      nonempty(b.text),
      nonempty(b.requestId, 128),
    );
    if (!result.duplicate) {
      const token = repo.beginGeneration(owner, id, "question"),
        r = repo.raw(owner, id),
        q = await nextQuestion(r.settingsSnapshot, r.fragments);
      repo.finishQuestion(owner, id, token, q.text, q.source);
    }
    const interview = repo.get(owner, id);
    return Response.json({
      interview,
      question: interview.question,
      source: interview.questionSource,
    });
  }
  if (action === "fragments" && parts[3] && req.method === "PATCH")
    return Response.json({
      interview: repo.revise(owner, id, parts[3], nonempty(b.text)),
    });
  if (action === "postcard" && req.method === "POST")
    return Response.json({
      interview: repo.postcard(owner, id, nonempty(b.text, 5000)),
    });
  if (action === "memoir" && req.method === "POST") {
    if (b.approved === true)
      return Response.json({
        interview: repo.approveMemoir(owner, id, nonempty(b.text, 20000)),
      });
    const r = repo.raw(owner, id);
    if (!r.fragments.length) throw new AppError("먼저 이야기를 남겨 주세요.");
    const token = repo.beginGeneration(owner, id, "memoir"),
      draft = await memoirDraft(r.settingsSnapshot, r.fragments);
    if (
      !repo.finishMemoir(
        owner,
        id,
        token,
        draft.text,
        draft.sources,
        draft.source,
      )
    )
      throw new AppError(
        "원문이 바뀌었습니다. 회고록을 다시 만들어 주세요.",
        409,
      );
    return Response.json({
      interview: repo.get(owner, id),
      source: draft.source,
    });
  }
  throw new AppError("지원하지 않는 요청입니다.", 404);
}
