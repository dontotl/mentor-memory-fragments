"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "@/components/api";
import { speechChunks } from "./audio-state";
export function usePlayback(interviewId?: string) {
  const audio = useRef<HTMLAudioElement | null>(null),
    request = useRef<AbortController | null>(null),
    generation = useRef(0),
    url = useRef("");
  const [playing, setPlaying] = useState(false),
    [error, setError] = useState(""),
    [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const stop = useCallback(() => {
    generation.current++;
    request.current?.abort();
    audio.current?.pause();
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = "";
    setPlaying(false);
  }, []);
  useEffect(() => stop, [stop]);
  async function speak(text: string) {
    stop();
    setElapsedMs(null);
    const started = performance.now();
    const token = generation.current;
    request.current = new AbortController();
    setError("");
    setPlaying(true);
    try {
      for (const chunk of speechChunks(text)) {
        if (token !== generation.current) return;
        const r = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: chunk, interviewId }),
          signal: request.current.signal,
        });
        if (!r.ok) {
          const e = await r.json();
          throw new Error(e.error);
        }
        const blob = await r.blob();
        if (token !== generation.current) return;
        url.current = URL.createObjectURL(blob);
        audio.current = new Audio(url.current);
        if (chunk === speechChunks(text)[0])
          setElapsedMs(Math.round(performance.now() - started));
        await new Promise<void>((resolve, reject) => {
          audio.current!.onended = () => resolve();
          audio.current!.onerror = () =>
            reject(
              new Error("음성을 재생하지 못했어요. 글로 계속 읽을 수 있어요."),
            );
          audio.current!.onpause = () => {
            if (token !== generation.current) resolve();
          };
          void audio.current!.play().catch(reject);
        });
        if (url.current) URL.revokeObjectURL(url.current);
      }
      if (token === generation.current) setPlaying(false);
    } catch (e) {
      if (token === generation.current) {
        setError(errorText(e));
        setPlaying(false);
      }
    }
  }
  return { playing, error, speak, stop, elapsedMs };
}
type Phase =
  "ready" | "listening" | "silence_wait" | "paused" | "transcribing" | "review";
export function useRecorder(
  seconds: 3 | 5 | 7,
  onText: (text: string) => void,
  interviewId?: string,
) {
  const [phase, setPhase] = useState<Phase>("ready"),
    [remaining, setRemaining] = useState(seconds as number),
    [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    context = useRef<AudioContext | null>(null),
    timer = useRef<ReturnType<typeof setInterval> | null>(null),
    abort = useRef<AbortController | null>(null),
    callback = useRef(onText),
    phaseRef = useRef<Phase>("ready"),
    lastVoice = useRef(0),
    heardVoice = useRef(false),
    elapsed = useRef(0),
    generation = useRef(0),
    blob = useRef<Blob | null>(null);
  callback.current = onText;
  const transition = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const release = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void context.current?.close();
    context.current = null;
  };
  async function transcribe(recording: Blob, token: number) {
    transition("transcribing");
    abort.current = new AbortController();
    const form = new FormData();
    if (interviewId) form.append("interviewId", interviewId);
    form.append(
      "audio",
      recording,
      recording.type.includes("mp4") ? "recording.m4a" : "recording.webm",
    );
    try {
      const r = await api<{ text: string }>("/api/stt", {
        method: "POST",
        body: form,
        signal: abort.current.signal,
      });
      if (token !== generation.current) return;
      callback.current(r.text);
      transition("review");
    } catch (e) {
      if (token === generation.current) {
        setError(errorText(e));
        transition("review");
      }
    }
  }
  const commit = () => {
    if (recorder.current && recorder.current.state !== "inactive") {
      if (recorder.current.state === "paused") recorder.current.resume();
      recorder.current.stop();
      release();
    }
  };
  const cancel = useCallback(() => {
    generation.current++;
    abort.current?.abort();
    if (recorder.current) {
      recorder.current.onstop = null;
      if (recorder.current.state !== "inactive") recorder.current.stop();
    }
    release();
    phaseRef.current = "ready";
    setPhase("ready");
  }, []);
  useEffect(() => cancel, [cancel]);
  async function start() {
    cancel();
    setError("");
    blob.current = null;
    const token = generation.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "마이크는 localhost 또는 HTTPS에서 사용할 수 있어요. 지금은 글로 입력해 주세요.",
        );
      const input = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (token !== generation.current) {
        input.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = input;
      const mime = ["audio/webm;codecs=opus", "audio/mp4"].find((m) =>
        MediaRecorder.isTypeSupported(m),
      );
      const rec = new MediaRecorder(
        input,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = rec;
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        const recording = new Blob(chunks, { type: rec.mimeType });
        blob.current = recording;
        if (token === generation.current) void transcribe(recording, token);
      };
      const audioContext = new AudioContext();
      context.current = audioContext;
      await audioContext.resume();
      if (token !== generation.current) {
        input.getTracks().forEach((track) => track.stop());
        if (audioContext.state !== "closed") void audioContext.close();
        return;
      }
      const source = context.current.createMediaStreamSource(input),
        analyser = context.current.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      heardVoice.current = false;
      lastVoice.current = Date.now();
      elapsed.current = 0;
      rec.start(250);
      transition("listening");
      timer.current = setInterval(() => {
        if (phaseRef.current === "paused") return;
        elapsed.current += 100;
        analyser.getFloatTimeDomainData(data);
        let energy = 0;
        for (const sample of data) energy += sample * sample;
        const voice = Math.sqrt(energy / data.length) > 0.018;
        if (voice) {
          heardVoice.current = true;
          lastVoice.current = Date.now();
          if (phaseRef.current !== "listening") transition("listening");
        } else if (heardVoice.current) {
          const left = Math.max(
            0,
            seconds - Math.floor((Date.now() - lastVoice.current) / 1000),
          );
          setRemaining(left);
          if (phaseRef.current !== "silence_wait") transition("silence_wait");
          if (left === 0) commit();
        }
        if (elapsed.current >= 120000) commit();
      }, 100);
    } catch (e) {
      if (token !== generation.current) return;
      release();
      setError(errorText(e));
      transition("ready");
    }
  }
  function pause() {
    if (!recorder.current) return;
    recorder.current.pause();
    stream.current?.getTracks().forEach((t) => (t.enabled = false));
    void context.current?.suspend();
    transition("paused");
  }
  function resume() {
    stream.current?.getTracks().forEach((t) => (t.enabled = true));
    void context.current?.resume();
    recorder.current?.resume();
    lastVoice.current = Date.now();
    transition("listening");
  }
  return {
    phase,
    remaining,
    error,
    start,
    commit,
    pause,
    resume,
    cancel,
    retry: () => {
      if (!blob.current) return;
      abort.current?.abort();
      generation.current++;
      setError("");
      return transcribe(blob.current, generation.current);
    },
    canRetry: !!blob.current,
  };
}
