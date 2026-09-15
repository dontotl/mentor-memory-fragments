"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useInterview } from "@/hooks/use-interview";
import { Action, ErrorNotice, Heading, Loading, Photo } from "./common";
import { post, errorText } from "./api";
import type { Interview } from "@/lib/contracts";
async function downloadCard(interview: Interview, text: string) {
  const image = new Image();
  image.src = interview.photoUrl;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  const context = canvas.getContext("2d")!;
  context.font = "36px sans-serif";
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const letter of paragraph) {
      if (context.measureText(line + letter).width > 1010) {
        lines.push(line);
        line = "";
      }
      line += letter;
    }
    lines.push(line);
  }
  canvas.height = Math.max(1450, 1010 + lines.length * 56);
  context.fillStyle = "#f7f5f0";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.max(1040 / image.width, 700 / image.height),
    w = image.width * scale,
    h = image.height * scale;
  context.save();
  context.beginPath();
  context.rect(80, 80, 1040, 700);
  context.clip();
  context.drawImage(image, 80 + (1040 - w) / 2, 80 + (700 - h) / 2, w, h);
  context.restore();
  context.fillStyle = "#1b5e20";
  context.font = "bold 44px sans-serif";
  context.fillText("사진에 담긴 나의 이야기", 90, 870);
  context.fillStyle = "#1a202c";
  context.font = "36px sans-serif";
  lines.forEach((line, i) => context.fillText(line, 90, 950 + i * 56));
  context.font = "25px sans-serif";
  context.fillStyle = "#566350";
  context.fillText(
    interview.isSample ? "기억의 조각 · 가상 샘플 기록" : "기억의 조각",
    90,
    canvas.height - 65,
  );
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("이미지를 만들지 못했어요."))),
      "image/png",
    ),
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "기억의조각-엽서.png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function PostcardScreen({ id }: { id: string }) {
  const { interview, setInterview, error, setError } = useInterview(id);
  const [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    if (interview)
      setText(
        interview.postcardText ||
          interview.fragments.map((f) => f.text).join("\n"),
      );
  }, [interview]);
  async function save(download = false) {
    setBusy(true);
    setError("");
    try {
      const r = await post<{ interview: Interview }>(
        `/api/interviews/${id}/postcard`,
        { text },
      );
      setInterview(r.interview);
      setSaved(true);
      if (download) await downloadCard(r.interview, text);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (!interview) return error ? <ErrorNotice message={error} /> : <Loading />;
  return (
    <>
      <Heading
        title="첫 번째 추억 엽서가 왔어요"
        description="내가 들려준 이야기예요. 마음에 들게 고치고 간직해 주세요."
      />
      <div className="two-column">
        <article className="postcard-paper">
          <Photo interview={interview} />
          <p className="postcard-title">사진에 담긴 나의 이야기</p>
          <p className="postcard-copy">{text}</p>
          <span className="postcard-sign">기억의 조각</span>
        </article>
        <section className="editor-pane">
          <label className="field">
            <span>엽서에 담을 글</span>
            <textarea
              rows={7}
              disabled={busy}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setSaved(false);
              }}
              maxLength={4000}
            />
          </label>
          <p className="small muted">처음 들려주신 원문은 별도로 보존돼요.</p>
          <ErrorNotice message={error} />
          {saved && (
            <p role="status" className="success-message">
              보관함에 엽서를 저장했어요.
            </p>
          )}
          <Action disabled={busy || !text.trim()} onClick={() => save()}>
            {busy ? "저장하고 있어요…" : "확인하고 엽서 저장"}
          </Action>
          <Action
            secondary
            disabled={busy || !text.trim()}
            onClick={() => save(true)}
          >
            엽서 PNG 내려받기
          </Action>
          <div className="choice-section">
            <h2>오늘은 여기까지도 좋아요.</h2>
            <p>더 떠오르는 이야기가 있다면 천천히 이어가세요.</p>
            <Link href={`/interview/${id}`} className="primary-link">
              이야기 더 들려주기
            </Link>
            <Link href="/library" className="text-link">
              보관함으로 가기
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
