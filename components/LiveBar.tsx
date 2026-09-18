"use client";

import { handColor } from "@/lib/overlay";
import type { SourceKind, TrackedHand } from "@/lib/types";

type Props = {
  source: SourceKind;
  fps: number;
  hands: TrackedHand[];
  mirror: boolean;
  skeleton: boolean;
  trail: boolean;
  onMirror: (v: boolean) => void;
  onSkeleton: (v: boolean) => void;
  onTrail: (v: boolean) => void;
  onDisconnect: () => void;
};

function Chip({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-[11px] leading-none transition-colors ${
        on ? "border-accent/60 bg-accent/15 text-accent" : "border-line bg-field text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

/** 2단계 — 라이브 화면 상단의 얇은 조작 바. 영상이 주인공이라 최대한 작게. */
export default function LiveBar(p: Props) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent px-3 pb-6 pt-2">
      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={p.onDisconnect}
          className="rounded-md border border-line bg-field/80 px-2 py-1 text-[11px] leading-none text-text hover:border-danger hover:text-danger"
        >
          ← 연결 해제
        </button>
        <span className="text-[11px] text-muted tabular-nums">
          {p.source === "remote" ? "폰" : "PC 카메라"} · <b className="font-semibold text-accent">{p.fps} fps</b>
        </span>
      </div>

      <div className="pointer-events-auto ml-auto flex items-center gap-1.5">
        {p.hands.map((h, i) => (
          <span
            key={`${h.side}-${i}`}
            className="rounded-md border bg-black/50 px-2 py-1 text-[11px] leading-none"
            style={{ borderColor: `${handColor(h.side)}80`, color: handColor(h.side) }}
            title={`${h.gesture.detail} · 신뢰도 ${(h.score * 100).toFixed(0)}%`}
          >
            {h.side === "Left" ? "L" : "R"} {h.gesture.emoji} {h.gesture.name}
          </span>
        ))}
        <span className="mx-1 h-4 w-px bg-line" aria-hidden />
        <Chip on={p.mirror} onClick={() => p.onMirror(!p.mirror)} title="좌우 반전">반전</Chip>
        <Chip on={p.skeleton} onClick={() => p.onSkeleton(!p.skeleton)} title="관절 그리기">관절</Chip>
        <Chip on={p.trail} onClick={() => p.onTrail(!p.trail)} title="손가락 끝 궤적">궤적</Chip>
      </div>
    </div>
  );
}
