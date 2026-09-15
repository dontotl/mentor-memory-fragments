"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "@phosphor-icons/react";
import { api } from "@/components/api";
import { RecordLink } from "@/components/common";
import type { Interview } from "@/lib/contracts";
export default function Home() {
  const [records, setRecords] = useState<Interview[]>([]);
  useEffect(() => {
    api<{ interviews: Interview[] }>("/api/interviews")
      .then((r) => setRecords(r.interviews.slice(0, 2)))
      .catch(() => {});
  }, []);
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">내 말로 남기는, 나의 이야기</p>
          <h1>
            사진 한 장에
            <br />
            담긴 이야기
          </h1>
          <p className="hero-description">
            떠오르는 만큼만 들려주세요.
            <br />
            그날의 기억이 엽서 한 장이 됩니다.
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href="/start">
              사진으로 시작하기 <ArrowRight size={22} />
            </Link>
            <Link className="text-link" href="/preview">
              먼저 구경할게요 <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
        <figure className="hero-photo">
          <img
            src="/samples/spring-picnic.png"
            alt="나무 아래 돗자리에서 김밥을 나누는 가상 가족의 봄 소풍"
            fetchPriority="high"
          />
          <figcaption>
            이런 사진 한 장이면 충분해요. AI 생성 샘플 사진
          </figcaption>
        </figure>
      </section>
      <section className="home-note">
        <div className="note-mark" aria-hidden="true">
          “
        </div>
        <div>
          <h2>길게 말하지 않아도 괜찮아요.</h2>
          <p>한마디로 엽서를 남기고, 원할 때만 이야기를 이어가세요.</p>
        </div>
      </section>
      <section className="recent">
        <div className="section-title">
          <h2>다시 꺼내 보는 기억</h2>
          <Link className="text-link" href="/library">
            모두 보기 <ArrowRight size={18} />
          </Link>
        </div>
        {records.length ? (
          records.map((r) => <RecordLink key={r.id} record={r} />)
        ) : (
          <p className="empty-copy">
            아직 남긴 이야기가 없어요. 첫 번째 추억을 기다리고 있어요.
          </p>
        )}
      </section>
      <p className="privacy-foot">
        <ShieldCheck size={20} /> 사진과 글은 연결된 서버에 저장돼요. 보관함에서
        언제든 삭제할 수 있어요.
      </p>
    </>
  );
}
