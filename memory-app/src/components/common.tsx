"use client";
import { Button } from "konsta/react";
import Link from "next/link";
import type { Interview } from "@/lib/contracts";
export function Action({
  children,
  onClick,
  disabled = false,
  secondary = false,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  secondary?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <Button
      type={type}
      large
      rounded
      outline={secondary}
      disabled={disabled}
      onClick={onClick}
      className={secondary ? "action secondary" : "action"}
    >
      {children}
    </Button>
  );
}
export function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <p className="error-message" role="alert">
      {message}
    </p>
  ) : null;
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <div className="skeleton photo-skeleton" />
      <p>기억을 불러오고 있어요.</p>
    </div>
  );
}
export function Photo({ interview }: { interview: Interview }) {
  return (
    <figure className="memory-photo">
      <img
        src={interview.photoUrl}
        alt={
          interview.isSample
            ? "가상 가족이 나무 아래에서 봄 소풍을 즐기는 AI 생성 샘플"
            : "내가 선택한 추억 사진"
        }
      />
      {interview.isSample && (
        <figcaption>AI로 만든 가상 소풍 사진 · 샘플 기록</figcaption>
      )}
    </figure>
  );
}
export function Heading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="page-heading">
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  );
}
export function RecordLink({ record }: { record: Interview }) {
  return (
    <Link
      className="record-row"
      href={`/${record.stage === "interview" ? "interview" : record.stage}/${record.id}`}
    >
      <img src={record.photoUrl} alt="" />
      <div>
        <span className="small muted">
          {record.isSample ? "샘플 이야기" : "나의 이야기"} ·{" "}
          {new Date(record.updatedAt).toLocaleDateString("ko-KR")}
        </span>
        <h3>{record.title || "사진 속 이야기"}</h3>
        <p>
          {record.stage === "memoir"
            ? record.memoirApproved
              ? "승인한 회고록"
              : "회고록 초안"
            : record.stage === "postcard"
              ? "추억 엽서"
              : "이어서 이야기하기"}
        </p>
      </div>
      <span aria-hidden="true">›</span>
    </Link>
  );
}
