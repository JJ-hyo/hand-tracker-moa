"use client";

import { MOTIONS, type MotionId } from "@/lib/motions";

type Props = { value: MotionId; onChange: (id: MotionId) => void };

/** 연결 화면의 모션 선택 — 칩. 선택한 모션은 라이브 화면에서 바로 시작된다. */
export default function MotionPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="section-title">Motion</div>
      <div className="flex flex-wrap justify-center gap-2">
        {MOTIONS.map((m) => {
          const on = m.id === value;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(m.id)}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] transition-colors ${
                on ? "border-accent/60 bg-accent/15 font-semibold text-accent" : "border-line bg-field text-muted hover:text-text"
              }`}
              title={m.description}
            >
              {m.name}
            </button>
          );
        })}
      </div>
      <div className="text-xs text-dim">{MOTIONS.find((m) => m.id === value)?.description}</div>
    </div>
  );
}
