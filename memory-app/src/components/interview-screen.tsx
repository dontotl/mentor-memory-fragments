"use client";
import { useRef, useState } from "react";
import { turnIdentity } from "@/hooks/audio-state";
import { useRouter } from "next/navigation";
import { Microphone, SpeakerHigh, Pause, Stop } from "@phosphor-icons/react";
import { useInterview } from "@/hooks/use-interview";
import { usePlayback, useRecorder } from "@/hooks/use-audio";
import { useSettings } from "./shell";
import { Action, ErrorNotice, Heading, Loading, Photo } from "./common";
import { post, errorText } from "./api";
import type { Interview } from "@/lib/contracts";
const samples = [
  "봄에 가족과 소풍을 갔어요. 어머니가 싸 주신 김밥을 나무 아래에서 먹었어요.",
  "아버지는 사진을 찍는 걸 좋아하셨어요.",
  "정확한 연도는 기억나지 않지만 그날 참 즐거웠어요.",
];
export function InterviewScreen({ id }: { id: string }) {
  const router = useRouter();
  const { interview, setInterview, error, setError } = useInterview(id);
  const { settings } = useSettings();
  const [text, setText] = useState(""),
    [mode, setMode] = useState<"voice" | "text" | null>(null),
    [question, setQuestion] = useState(""),
    [source, setSource] = useState(""),
    [busy, setBusy] = useState(false);
  const requestIdentity = useRef<{ text: string; id: string } | null>(null);
  const playback = usePlayback(id);
  const recorder = useRecorder(settings?.silenceSeconds ?? 5, setText, id);
  const inputMode = mode ?? settings?.inputMode ?? "voice";
  const recording = ["listening", "silence_wait", "paused"].includes(
    recorder.phase,
  );
  const currentQuestion =
    question ||
    interview?.question ||
    (interview?.fragments.length
      ? "그날의 기억 중 더 남기고 싶은 이야기가 있으세요?"
      : "이 사진을 보니 어떤 기억이 가장 먼저 떠오르세요?");
  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    playback.stop();
    try {
      const r = await post<{
        interview: Interview;
        question: string;
        source: string;
      }>(`/api/interviews/${id}/turns`, {
        text,
        requestId: (requestIdentity.current = turnIdentity(
          requestIdentity.current,
          text,
          () => crypto.randomUUID(),
        )).id,
      });
      setInterview(r.interview);
      setQuestion(r.question);
      setSource(r.source);
      setText("");
      requestIdentity.current = null;
      recorder.cancel();
      if (r.interview.fragments.length === 1) router.push(`/postcard/${id}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    setBusy(true);
    setError("");
    playback.stop();
    try {
      await post(`/api/interviews/${id}/memoir`, {});
      router.push(`/memoir/${id}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  if (!interview) return error ? <ErrorNotice message={error} /> : <Loading />;
  return (
    <>
      <Heading
        title={
          interview.fragments.length
            ? "조금 더 들려주실래요?"
            : "사진 속으로, 천천히"
        }
        description={
          interview.fragments.length
            ? "두세 마디 더 남기거나, 지금 회고록을 완성해도 좋아요."
            : "정확한 날짜가 기억나지 않아도 괜찮아요."
        }
      />
      <div className="two-column interview-layout">
        <Photo interview={interview} />
        <section className="conversation">
          <div className="question-box">
            <span className="small muted">기억을 여는 질문</span>
            <h2>{currentQuestion}</h2>
            <button
              className="text-link"
              onClick={() => {
                recorder.cancel();
                playback.playing
                  ? playback.stop()
                  : void playback.speak(currentQuestion);
              }}
            >
              {playback.playing ? (
                <Stop size={21} />
              ) : (
                <SpeakerHigh size={21} />
              )}{" "}
              {playback.playing ? "재생 중단" : "질문 듣기"}
            </button>
            <p className="small muted">
              {(source || interview.questionSource) === "ollama"
                ? "로컬 AI가 이어 묻는 질문"
                : "안내 질문 · 사진 속 관계와 연도를 추정하지 않아요"}
            </p>
          </div>
          <ErrorNotice message={playback.error} />
          <div className="mode-switch" role="group" aria-label="답변 입력 방식">
            <button
              aria-pressed={inputMode === "voice"}
              onClick={() => setMode("voice")}
            >
              말로 답하기
            </button>
            <button
              aria-pressed={inputMode === "text"}
              onClick={() => {
                recorder.cancel();
                setMode("text");
              }}
            >
              글로 답하기
            </button>
          </div>
          {inputMode === "voice" && (
            <div className="recorder">
              <p role="status" className="record-status">
                {recorder.phase === "listening"
                  ? "듣고 있어요. 편하게 말씀하세요."
                  : recorder.phase === "silence_wait"
                    ? `다시 말씀하시면 계속 들어요. ${recorder.remaining}초`
                    : recorder.phase === "paused"
                      ? "생각하는 시간이에요. 마이크가 꺼져 있어요."
                      : recorder.phase === "transcribing"
                        ? "녹음한 말을 글로 바꾸고 있어요."
                        : recorder.phase === "review"
                          ? "글을 확인하고 따로 보내 주세요."
                          : "아래 마이크를 누르면 듣기 시작해요."}
              </p>
              {!recording && (
                <button
                  className="mic-button"
                  disabled={recorder.phase === "transcribing" || busy}
                  onClick={() => {
                    playback.stop();
                    void recorder.start();
                  }}
                  aria-label="녹음 시작"
                >
                  <Microphone size={34} weight="fill" />
                </button>
              )}
              {recording && (
                <div className="button-row">
                  <Action
                    secondary
                    onClick={() => {
                      playback.stop();
                      recorder.phase === "paused"
                        ? recorder.resume()
                        : recorder.pause();
                    }}
                  >
                    <Pause size={20} />
                    {recorder.phase === "paused"
                      ? "다시 시작"
                      : "잠깐 생각할게요"}
                  </Action>
                  <Action onClick={recorder.commit}>다 말했어요</Action>
                </div>
              )}
              <p className="small muted">
                묵음 {settings?.silenceSeconds ?? 5}초 기다림 · 한 번에 최대 2분
                <br />
                녹음 종료 후 전사하며, 실시간 자막은 제공하지 않아요.
              </p>
              <ErrorNotice message={recorder.error} />
              {recorder.error && recorder.canRetry && (
                <button
                  className="text-link"
                  onClick={() => void recorder.retry()}
                >
                  방금 녹음 다시 전사하기
                </button>
              )}
            </div>
          )}
          <label className="field">
            <span>
              {inputMode === "voice" ? "내 말 확인하고 고치기" : "내 이야기"}
            </span>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="떠오르는 이야기를 적어 주세요."
              disabled={recording || busy || recorder.phase === "transcribing"}
            />
          </label>
          <p className="small muted">
            보내기 전 글은 새로고침하면 사라져요. 보낸 이야기는 복구돼요.
          </p>
          {interview.isSample && (
            <details className="sample-answers">
              <summary>가상 답변 골라 넣기</summary>
              <p className="small">
                선택한 대본만 입력돼요. 실제 음성 인식 결과가 아니에요.
              </p>
              {samples.map((s) => (
                <button
                  disabled={
                    recording || busy || recorder.phase === "transcribing"
                  }
                  key={s}
                  onClick={() => {
                    setText(s);
                    setMode("text");
                  }}
                >
                  {s}
                </button>
              ))}
            </details>
          )}
          <ErrorNotice message={error} />
          <Action
            disabled={
              !text.trim() ||
              busy ||
              recording ||
              recorder.phase === "transcribing"
            }
            onClick={send}
          >
            {busy
              ? "이야기를 정리하고 있어요…"
              : interview.fragments.length
                ? "확인한 이야기 보내기"
                : "확인하고 엽서 만들기"}
          </Action>
          {interview.fragments.length > 0 && (
            <Action
              secondary
              disabled={
                busy ||
                recording ||
                recorder.phase === "transcribing" ||
                !!text.trim()
              }
              onClick={finish}
            >
              여기까지 회고록으로 남기기
            </Action>
          )}
        </section>
      </div>
      {interview.fragments.length > 0 && (
        <section className="saved-fragments">
          <h2>지금까지 남긴 이야기 {interview.fragments.length}개</h2>
          {interview.fragments.map((f, i) => (
            <blockquote key={f.id}>
              <span className="small muted">이야기 {i + 1}</span>
              <p>{f.text}</p>
            </blockquote>
          ))}
        </section>
      )}
    </>
  );
}
