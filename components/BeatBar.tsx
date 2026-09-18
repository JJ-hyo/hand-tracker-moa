"use client";

import { handColor, resultColor } from "@/lib/overlay";
import type { MotionState } from "@/lib/motions/types";

type Props = {
  state: MotionState;
  name: string;
  onRestart: () => void;
  onStop: () => void;
};

/**
 * 박자 바 — 라이브 화면 상단 바 바로 아래 (1인칭에선 손이 아래쪽에 있어 위에 둔다).
 * 패턴 칸(R L R L)에 현재 박이 흐르고, 각 칸엔 최근 판정이 점으로 남는다: 가운데=정확, 왼쪽=빠름, 오른쪽=늦음.
 * 정확도는 최근 8박 평균이라 천천히 움직인다.
 */
export default function BeatBar({ state, name, onRestart, onStop }: Props) {
  const { pattern, step, phase, countIn, history, accuracy, okMs } = state;

  // 칸별 최근 기록: 같은 step의 가장 최근 것
  const lastByStep = pattern.map((_, i) => [...history].reverse().find((r) => r.step === i));

  return (
    <div className="pointer-events-none absolute inset-x-0 top-12 z-10 flex justify-center px-3">
      <div className="pointer-events-auto flex items-center gap-3 rounded-[12px] border border-line bg-black/60 px-3 py-2 backdrop-blur-sm">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{name} · {state.bpm}</span>

        <div className="flex items-center gap-1.5">
          {pattern.map((side, i) => {
            const active = countIn === 0 && step === i;
            const rec = lastByStep[i];
            const color = handColor(side);
            return (
              <div
                key={i}
                className="relative flex h-8 w-11 items-center justify-center overflow-hidden rounded-md border font-mono text-[12px] font-medium"
                style={{
                  borderColor: active ? color : "var(--color-line)",
                  color: active ? color : "var(--color-muted)",
                  background: active ? `${color}1f` : "var(--color-field)",
                }}
              >
                {countIn > 0 ? (i === pattern.length - countIn ? countIn : "") : side === "Left" ? "L" : "R"}
                {/* 진행 게이지 */}
                {active && <span className="absolute bottom-0 left-0 h-0.5 bg-current" style={{ width: `${phase * 100}%` }} />}
                {/* 판정 점 */}
                {rec && countIn === 0 && (
                  <span
                    className="absolute top-1 h-1.5 w-1.5 rounded-full"
                    style={{
                      background: resultColor(rec.side, rec.result),
                      left: `calc(50% + ${Math.max(-1, Math.min(1, (rec.offsetMs ?? 0) / okMs)) * 16}px - 3px)`,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <span className="font-mono text-[11px] tabular-nums text-muted">
          {countIn > 0 ? "준비" : <><b className="text-text">{Math.round(accuracy * 100)}</b>%</>}
        </span>

        <span className="mx-0.5 h-4 w-px bg-line" aria-hidden />
        <button type="button" onClick={onRestart} className="rounded-md border border-line bg-field/80 px-2 py-1 text-[11px] leading-none text-text hover:text-accent">다시</button>
        <button type="button" onClick={onStop} className="rounded-md border border-line bg-field/80 px-2 py-1 text-[11px] leading-none text-muted hover:text-text">끄기</button>
      </div>
    </div>
  );
}
