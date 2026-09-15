"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash, Images } from "@phosphor-icons/react";
import { api, errorText } from "@/components/api";
import { ErrorNotice, Heading, Loading, RecordLink } from "@/components/common";
import type { Interview } from "@/lib/contracts";
export default function Library() {
  const [records, setRecords] = useState<Interview[] | null>(null),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("all"),
    [deleting, setDeleting] = useState("");
  useEffect(() => {
    api<{ interviews: Interview[] }>("/api/interviews")
      .then((r) => setRecords(r.interviews))
      .catch((e) => setError(errorText(e)));
  }, []);
  async function remove(r: Interview) {
    if (
      !confirm(
        `“${r.title}”의 사진, 원문, 엽서와 회고록을 삭제할까요? 삭제 후 복구할 수 없어요.`,
      )
    )
      return;
    setDeleting(r.id);
    try {
      await api(`/api/interviews/${r.id}`, { method: "DELETE" });
      setRecords((current) => current!.filter((x) => x.id !== r.id));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setDeleting("");
    }
  }
  return (
    <>
      <Heading
        title="차곡차곡, 나의 기억"
        description="이 기기에서 남긴 이야기예요. 언제든 다시 읽고 이어갈 수 있어요."
      />
      <div className="library-toolbar">
        <label className="field">
          <span className="sr-only">기록 종류</span>
          <select
            aria-label="기록 종류"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">모든 기록</option>
            <option value="postcard">엽서</option>
            <option value="memoir">회고록</option>
            <option value="interview">이야기 중</option>
          </select>
        </label>
        <span className="muted">{records?.length ?? 0}개의 기억</span>
      </div>
      <ErrorNotice message={error} />
      {!records && !error ? (
        <Loading />
      ) : records?.length ? (
        <div className="record-list">
          {records
            .filter((r) => filter === "all" || r.stage === filter)
            .map((r) => (
              <div className="library-record" key={r.id}>
                <RecordLink record={r} />
                <button
                  className="delete-button"
                  aria-label={`${r.title} 삭제`}
                  disabled={deleting === r.id}
                  onClick={() => remove(r)}
                >
                  <Trash size={22} />
                  삭제
                </button>
              </div>
            ))}
        </div>
      ) : (
        <div className="empty-state">
          <Images size={52} weight="light" />
          <h2>아직 첫 장을 기다리고 있어요</h2>
          <p>사진 한 장과 짧은 이야기로 시작해 보세요.</p>
          <Link className="primary-link" href="/start">
            사진으로 시작하기
          </Link>
        </div>
      )}
      <p className="privacy-foot">
        이 기록은 현재 브라우저의 게스트 세션으로 열어요. 쿠키를 지우거나 다른
        기기로 바꾸면 접근하지 못할 수 있어요.
      </p>
    </>
  );
}
