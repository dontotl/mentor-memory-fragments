"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useInterview } from "@/hooks/use-interview";
import { usePlayback } from "@/hooks/use-audio";
import { useSettings } from "./shell";
import { Action, ErrorNotice, Heading, Loading } from "./common";
import { api, post, errorText } from "./api";
import type { Interview, Fragment } from "@/lib/contracts";
function Source({
  fragment,
  index,
  onSave,
  disabled,
}: {
  fragment: Fragment;
  index: number;
  onSave: (id: string, text: string) => Promise<void>;
  disabled: boolean;
}) {
  const [text, setText] = useState(fragment.text),
    [busy, setBusy] = useState(false);
  return (
    <details className="source-fragment" id={`source-${fragment.id}`}>
      <summary>
        이야기 {index + 1} · 수정 {fragment.revisions.length}회
      </summary>
      <p className="small muted">최초 확인한 원문</p>
      <blockquote>{fragment.original}</blockquote>
      <label className="field">
        <span>현재 이야기 수정</span>
        <textarea
          disabled={busy || disabled}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />
      </label>
      <Action
        secondary
        disabled={busy || disabled || text === fragment.text || !text.trim()}
        onClick={async () => {
          setBusy(true);
          try {
            await onSave(fragment.id, text);
          } finally {
            setBusy(false);
          }
        }}
      >
        수정 이력 남기기
      </Action>
      {fragment.revisions.length > 0 && (
        <details>
          <summary>이전 수정 이력</summary>
          {fragment.revisions.map((r, i) => (
            <p key={i}>
              {i + 1}. {r}
            </p>
          ))}
        </details>
      )}
    </details>
  );
}
export function MemoirScreen({ id }: { id: string }) {
  const { interview, setInterview, error, setError } = useInterview(id),
    { settings } = useSettings();
  const [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [image, setImage] = useState(""),
    [prompt, setPrompt] = useState(""),
    [stale, setStale] = useState(false);
  const playback = usePlayback(id);
  const initializedId = useRef<string | null>(null);
  useEffect(() => {
    if (interview && initializedId.current !== interview.id) {
      initializedId.current = interview.id;
      setText(interview.memoirText);
    }
  }, [interview]);
  async function save(regenerate = false) {
    setBusy(true);
    setError("");
    try {
      const r = await post<{ interview: Interview }>(
        `/api/interviews/${id}/memoir`,
        regenerate ? {} : { text, approved: true },
      );
      setInterview(r.interview);
      setText(r.interview.memoirText);
      setSaved(!regenerate);
      setStale(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function editSource(fragmentId: string, value: string) {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ interview: Interview }>(
        `/api/interviews/${id}/fragments/${fragmentId}`,
        { method: "PATCH", body: JSON.stringify({ text: value }) },
      );
      setInterview(r.interview);
      setStale(true);
      setSaved(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function illustrate() {
    setBusy(true);
    setError("");
    try {
      const r = await post<{ url: string }>("/api/image", {
        prompt,
        interviewId: id,
      });
      setImage(r.url);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (!interview) return error ? <ErrorNotice message={error} /> : <Loading />;
  const sourcesStale =
    stale ||
    (interview.memoirSources ?? []).some(
      (source) =>
        interview.fragments.find(
          (fragment) => fragment.id === source.fragmentId,
        )?.revisions.length !== source.revision,
    );
  return (
    <>
      <Heading
        title="내 말로 엮은 한 편의 기억"
        description="원문을 함께 보며 이름과 날짜를 확인해 주세요. 마지막 결정은 내가 해요."
      />
      <div className="two-column memoir-layout">
        <section className="memoir-paper">
          <span className="status-label">
            {interview.isSample ? "가상 샘플 · " : ""}
            {interview.memoirApproved &&
            !sourcesStale &&
            text === interview.memoirText
              ? "내가 승인한 회고록"
              : "확인이 필요한 초안"}
          </span>
          <h2>{interview.title}</h2>
          <label className="field">
            <span>회고록 본문</span>
            <textarea
              className="memoir-text"
              disabled={busy}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setSaved(false);
              }}
              rows={13}
            />
          </label>
          <div className="source-links">
            <span>처음 만든 초안의 출처 순서</span>
            {(
              interview.memoirSources ??
              interview.fragments.map((f) => ({
                fragmentId: f.id,
                revision: f.revisions.length,
              }))
            ).map((source, i) => (
              <a
                key={`${source.fragmentId}-${i}`}
                href={`#source-${source.fragmentId}`}
              >
                초안 구성 순서 {i + 1}: 이야기{" "}
                {interview.fragments.findIndex(
                  (f) => f.id === source.fragmentId,
                ) + 1}{" "}
                (수정 {source.revision})
              </a>
            ))}
          </div>
          <p className="small muted">
            본문을 직접 고치면 문단 위치가 달라질 수 있어요. 출처는 초안을 만들
            때 사용한 이야기와 수정 번호를 보여줘요.
          </p>
          {sourcesStale && (
            <p className="notice">
              원문을 수정했어요. ‘원문으로 초안 다시 만들기’를 누르고 다시
              확인한 뒤 승인해 주세요.
            </p>
          )}
          <ErrorNotice message={error} />
          <ErrorNotice message={playback.error} />
          {saved && (
            <p role="status" className="success-message">
              승인한 회고록을 보관함에 저장했어요.
            </p>
          )}
          <Action
            disabled={busy || sourcesStale || !text.trim()}
            onClick={() => save()}
          >
            {busy ? "처리하고 있어요…" : "내용을 확인했고, 승인하여 저장"}
          </Action>
          <div className="button-row">
            <Action
              secondary
              disabled={busy || !text.trim()}
              onClick={() =>
                playback.playing ? playback.stop() : void playback.speak(text)
              }
            >
              {playback.playing ? "낭독 중단" : "회고록 낭독"}
            </Action>
            <Action secondary disabled={busy} onClick={() => save(true)}>
              원문으로 초안 다시 만들기
            </Action>
          </div>
          <Link className="text-link" href="/library">
            보관함으로 가기
          </Link>
        </section>
        <aside className="source-pane">
          <h2>내가 들려준 원문</h2>
          <p className="muted">수정해도 최초 원문과 이전 글은 남아요.</p>
          {interview.fragments.map((f, i) => (
            <Source
              key={f.id}
              fragment={f}
              index={i}
              onSave={editSource}
              disabled={busy}
            />
          ))}
          <details className="illustration">
            <summary>기억을 표현한 삽화 추가 (선택)</summary>
            <p>
              입력한 설명을 외부 이미지 API로 전송하며 비용이 발생할 수 있어요.
              원본 사진은 자동 전송하지 않아요.
            </p>
            <label className="field">
              <span>삽화 설명</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
              />
            </label>
            <Action
              disabled={busy || !settings?.image.hasKey || !prompt.trim()}
              onClick={illustrate}
            >
              설명을 전송하고 삽화 생성
            </Action>
            {!settings?.image.hasKey && (
              <Link href="/settings" className="text-link">
                설정에서 이미지 API 연결하기
              </Link>
            )}
            {image && (
              <figure>
                <img src={image} alt="이야기를 표현한 AI 생성 삽화" />
                <figcaption>기억을 표현한 AI 삽화</figcaption>
              </figure>
            )}
          </details>
        </aside>
      </div>
    </>
  );
}
