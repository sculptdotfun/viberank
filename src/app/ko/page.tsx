import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Trophy, Terminal, Shield, BarChart3 } from "lucide-react";
import { getServerDataLayer } from "@/lib/data";
import { buildCostBenchmark, percentile, shareAbove, usd, pct } from "@/lib/cost-benchmark";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";

const SITE = "https://www.viberank.app";
const TITLE = "Viberank — Claude Code·Codex AI 코딩 사용량 리더보드 | 바이브랭크";
const DESC =
  "Claude Code, OpenAI Codex, Gemini CLI 토큰 사용량을 실제 ccusage 데이터로 추적하고 전 세계 1,100+ 개발자와 비교하세요. npx viberank-cli 명령 하나로 무료 등록.";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "claude code 사용량",
    "claude code 토큰",
    "클로드 코드 사용량 확인",
    "claude 리더보드",
    "codex 사용량 확인",
    "ai 코딩 사용량",
    "ccusage",
    "바이브코딩",
    "토큰 사용량 리더보드",
  ],
  alternates: {
    canonical: `${SITE}/ko`,
    languages: {
      en: `${SITE}/`,
      ko: `${SITE}/ko`,
      "x-default": `${SITE}/`,
    },
  },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: `${SITE}/ko`,
    siteName: "Viberank",
    locale: "ko_KR",
    type: "website",
    images: [
      `/api/og?title=${encodeURIComponent("AI 코딩 사용량 리더보드")}&description=${encodeURIComponent("Claude Code · Codex · Gemini CLI — 실제 사용 데이터로 랭킹")}`,
    ],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

const FAQS = [
  {
    q: "Claude Code 사용량은 어떻게 확인하나요?",
    a: "Claude Code 안에서 /usage 명령을 입력하면 5시간 세션과 주간 한도 소진율을 볼 수 있습니다. 토큰 수와 비용까지 보려면 터미널에서 npx ccusage@latest daily를 실행하세요 — 로컬 로그를 읽어 일별 토큰 사용량과 API 환산 비용을 계산합니다.",
  },
  {
    q: "리더보드에는 어떻게 등록하나요?",
    a: "터미널에서 npx viberank-cli 한 줄이면 됩니다. 로컬 ccusage 데이터를 읽어 사용량 합계만 제출하며, 코드나 프롬프트는 절대 전송되지 않습니다. GitHub 로그인 시 인증 배지가 붙습니다.",
  },
  {
    q: "무료인가요?",
    a: "네. 리더보드, 프로필 페이지, 통계, README 배지 모두 무료이며 코드는 MIT 라이선스 오픈소스입니다.",
  },
  {
    q: "어떤 도구를 지원하나요?",
    a: "ccusage가 추적하는 모든 코딩 에이전트를 지원합니다 — Claude Code, OpenAI Codex, Gemini CLI, GitHub Copilot, OpenCode 등. 도구별 리더보드에서 따로 볼 수도 있습니다.",
  },
];

export default async function KoreanLandingPage() {
  let totalUsers = 0;
  let totalCost = 0;
  let benchmark = buildCostBenchmark([]);
  try {
    const dataLayer = await getServerDataLayer();
    const [site, spendRows] = await Promise.all([
      dataLayer.stats.getSiteStats(),
      dataLayer.stats.getSpendRows(),
    ]);
    totalUsers = site?.totalUsers ?? 0;
    totalCost = site?.totalCost ?? 0;
    benchmark = buildCostBenchmark(spendRows);
  } catch {
    // render static content
  }
  const hasBenchmark = benchmark.cohortSize > 0;

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "ko",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-background" lang="ko">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      <NavBar />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link href="/" className="inline-flex items-center gap-1.5 micro-label hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" />
          리더보드로 이동
        </Link>

        <p className="micro-label mb-3">한국어 안내</p>
        <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight mb-3">
          AI 코딩 사용량 리더보드, Viberank
        </h1>
        <p className="text-muted mb-8 max-w-2xl leading-relaxed">
          Claude Code, OpenAI Codex, Gemini CLI로 얼마나 코딩하고 있나요? Viberank(바이브랭크)는 실제{" "}
          <a
            href="https://github.com/ryoppippi/ccusage"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            ccusage
          </a>{" "}
          데이터로 집계한 공개 리더보드입니다.{" "}
          {totalUsers > 0 && (
            <>
              현재 <span className="text-foreground font-medium">{totalUsers.toLocaleString()}명의 개발자</span>가 총{" "}
              <span className="text-foreground font-mono">
                ${Math.round(totalCost / 1_000_000)}M+
              </span>{" "}
              상당(API 환산)의 사용량을 기록하고 있습니다.{" "}
            </>
          )}
          내 순위가 궁금하다면 명령 한 줄이면 충분합니다:
        </p>

        <div className="rounded-lg border border-accent/40 bg-surface-1 p-5 mb-10 max-w-2xl">
          <code className="font-mono text-accent text-base">npx viberank-cli</code>
          <p className="text-sm text-muted mt-2 mb-0">
            로컬 로그에서 사용량 합계만 제출합니다 — 코드와 프롬프트는 절대 컴퓨터 밖으로 나가지 않습니다.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-12">
          <div className="rounded-lg border border-border bg-surface-1 p-5">
            <Trophy className="w-5 h-5 text-accent mb-2" />
            <p className="font-medium mb-1">글로벌 랭킹</p>
            <p className="text-sm text-muted m-0">
              비용·토큰 기준 순위, 상위 3인 포디움, 도구별{" "}
              <Link href="/tool/claude" className="text-accent hover:underline">
                Claude Code
              </Link>
              {" · "}
              <Link href="/tool/codex" className="text-accent hover:underline">
                Codex
              </Link>{" "}
              보드.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-1 p-5">
            <BarChart3 className="w-5 h-5 text-accent mb-2" />
            <p className="font-medium mb-1">프로필 &amp; 통계</p>
            <p className="text-sm text-muted m-0">
              일별 사용량 차트, 모델별 분석, 연속 사용 스트릭.{" "}
              <Link href="/stats" className="text-accent hover:underline">
                전체 통계
              </Link>
              도 공개되어 있습니다.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-1 p-5">
            <Terminal className="w-5 h-5 text-accent mb-2" />
            <p className="font-medium mb-1">자동 제출</p>
            <p className="text-sm text-muted m-0">
              <code className="font-mono text-accent text-xs">viberank-cli autosubmit</code>으로 매일 자동
              업데이트 — 순위가 항상 최신으로 유지됩니다.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-1 p-5">
            <Shield className="w-5 h-5 text-accent mb-2" />
            <p className="font-medium mb-1">무료 &amp; 오픈소스</p>
            <p className="text-sm text-muted m-0">
              MIT 라이선스. GitHub 로그인 시 인증 배지, README용 실시간 순위 배지 제공.
            </p>
          </div>
        </div>

        {hasBenchmark && (
          <section className="mb-12 max-w-3xl">
            <h2 className="font-mono text-xl font-bold tracking-tight mb-3">
              Claude Code 실제 비용은 얼마일까?
            </h2>
            <p className="text-muted text-sm mb-5 leading-relaxed">
              대부분의 자료는 Anthropic이 공개한 개발자당 월 $150~250이라는 수치를 그대로 인용합니다. 하지만
              viberank는 직접 측정합니다 — 아래는 자신의 사용량을 실제로 추적하는 개발자{" "}
              {benchmark.cohortSize.toLocaleString("ko-KR")}명의 월 API 환산 비용 분포입니다.
            </p>
            <div className="rounded-lg border border-border overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="micro-label bg-surface-1 border-b border-border">
                    <th className="text-left px-4 py-2.5 font-normal">백분위</th>
                    <th className="text-right px-4 py-2.5 font-normal">월 API 환산 비용</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-mono">
                  {[25, 50, 75, 90].map((p) => (
                    <tr key={p}>
                      <td className="px-4 py-2.5 text-muted">{p === 50 ? "중앙값" : `p${p}`}</td>
                      <td className={`px-4 py-2.5 text-right ${p === 50 ? "text-accent font-bold" : "text-foreground"}`}>
                        {usd(percentile(benchmark, p))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              중앙값은 <span className="text-accent font-semibold">{usd(benchmark.medianMonthlyUsd)}</span>,
              그리고 <span className="text-accent font-semibold">{pct(shareAbove(benchmark, 250))}</span>가 월 $250을
              넘습니다. 단, 이 수치는 실제 청구액이 아니라 API 정가 기준 환산 비용이며, 사용량을 직접 측정해
              공개하는 개발자 집단이라 평균보다 무겁습니다.{" "}
              <Link href="/data" className="text-accent hover:underline">
                데이터와 방법론 전체 보기
              </Link>
            </p>
          </section>
        )}

        <section className="mb-12 max-w-3xl">
          <h2 className="font-mono text-xl font-bold tracking-tight mb-4">자주 묻는 질문</h2>
          <div className="space-y-3">
            {FAQS.map((f) => (
              <div key={f.q} className="rounded-lg border border-border bg-surface-1 p-4">
                <h3 className="font-medium mb-1.5">{f.q}</h3>
                <p className="text-sm text-muted">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="text-sm text-muted max-w-3xl">
          더 읽어보기 (영문):{" "}
          <Link href="/blog/how-much-does-claude-code-cost" className="text-accent hover:underline">
            Claude Code 실제 비용 데이터
          </Link>
          {", "}
          <Link href="/blog/claude-code-usage-limits" className="text-accent hover:underline">
            Claude Code 사용 한도 정리
          </Link>
          {", "}
          <Link href="/calculator" className="text-accent hover:underline">
            요금제 계산기
          </Link>
          .
        </p>
      </div>
      <Footer />
    </div>
  );
}
