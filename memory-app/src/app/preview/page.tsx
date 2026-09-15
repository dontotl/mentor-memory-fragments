"use client";
import Link from "next/link";
import { Heading } from "@/components/common";
export default function Preview() {
  return (
    <div className="narrow">
      <Heading
        title="한 장의 엽서가 되기까지"
        description="실제 가족의 정보가 없는 가상 소풍 이야기로 미리 살펴보세요."
      />
      <figure className="memory-photo">
        <img
          src="/samples/spring-picnic.png"
          alt="AI로 만든 가상 가족의 봄 소풍"
        />
        <figcaption>AI 생성 이미지와 가상 대본입니다.</figcaption>
      </figure>
      <div className="preview-steps">
        <section>
          <h2>사진을 보며 한마디</h2>
          <p>“이 사진을 보니 어떤 기억이 떠오르세요?”</p>
          <blockquote>
            봄에 가족과 소풍을 갔어요. 어머니가 싸 주신 김밥을 나무 아래에서
            먹었어요.
          </blockquote>
        </section>
        <section>
          <h2>내 말을 담은 엽서</h2>
          <p>
            글을 확인하고 고친 뒤, 사진과 함께 엽서로 저장해요. 여기서 마쳐도
            좋아요.
          </p>
        </section>
        <section>
          <h2>원한다면, 회고록으로</h2>
          <p>두세 번 더 이야기하고 원문을 대조해 한 편의 회고록을 완성해요.</p>
        </section>
      </div>
      <p className="notice">
        지금은 저장하지 않는 설명 화면이에요. 아래에서 시작하면 샘플 답변을 직접
        선택하고 실제 서버에 저장하는 텍스트 데모를 체험해요. 마이크 없이 진행할
        수 있어요.
      </p>
      <Link className="primary-link" href="/start">
        샘플로 직접 시작하기
      </Link>
      <a
        className="text-link download-sample"
        href="/samples/spring-picnic.png"
        download="가상-봄소풍-샘플.png"
      >
        샘플 사진 내려받기
      </a>
    </div>
  );
}
