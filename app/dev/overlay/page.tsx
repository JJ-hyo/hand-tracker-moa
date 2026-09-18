"use client";

import { useEffect, useRef, useState } from "react";
import { drawOverlay } from "@/lib/overlay";
import { classify } from "@/lib/gestures";
import type { Landmark, Side, TrackedHand } from "@/lib/types";
import LiveBar from "@/components/LiveBar";
import BeatBar from "@/components/BeatBar";
import { DrumMotion } from "@/lib/motions/drum";
import type { MotionState } from "@/lib/motions/types";
import drumCfg from "@/data/motions/drum.json";

// 카메라 없이 실루엣 + 드럼 판정을 확인하는 개발용 페이지 — /dev/overlay
// 가짜 손 두 개가 박자에 맞춰 내리친다. 일부러 늦게(5번째마다) / 손 바꿔서(9번째마다) 쳐서 피드백을 본다.

const base: [number, number][] = [
  [0.30, 0.86], [0.23, 0.78], [0.18, 0.68], [0.15, 0.60], [0.13, 0.53],
  [0.26, 0.58], [0.25, 0.46], [0.24, 0.38], [0.24, 0.31],
  [0.31, 0.56], [0.31, 0.43], [0.31, 0.34], [0.31, 0.27],
  [0.36, 0.58], [0.37, 0.46], [0.38, 0.38], [0.38, 0.32],
  [0.41, 0.62], [0.43, 0.53], [0.45, 0.46], [0.46, 0.41],
];

function hand(side: Side, dx: number, dy: number, mirrorX: boolean): TrackedHand {
  const lm: Landmark[] = base.map(([x, y]) => ({ x: (mirrorX ? 1 - x : x) + dx, y: y + dy, z: 0 }));
  return { side, score: 0.95, landmarks: lm, gesture: classify(lm) };
}

/** 타격 궤적: 박 직전 0.18초 동안 내려왔다가 0.22초 동안 올라감 (dy 0 → 0.16 → 0) */
function strikeOffset(msToBeat: number) {
  if (msToBeat > -180 && msToBeat <= 0) return 0.16 * (1 + msToBeat / 180);
  if (msToBeat > 0 && msToBeat < 220) return 0.16 * (1 - msToBeat / 220);
  return 0;
}

export default function OverlayDev() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<MotionState | null>(null);
  const [hands, setHands] = useState<TrackedHand[]>([]);

  useEffect(() => {
    const c = ref.current!;
    c.width = 1280; c.height = 720;
    const ctx = c.getContext("2d")!;
    const motion = new DrumMotion();
    const t0 = performance.now();
    motion.start(t0);
    const period = 60000 / drumCfg.bpm;
    const pattern = drumCfg.pattern as Side[];
    const font = getComputedStyle(document.body).fontFamily;
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const rel = now - t0;
      // 이 프레임에 가장 가까운 "연주 박" 찾기 (카운트인 이후)
      const i = Math.round(rel / period);
      const dys: Record<Side, number> = { Left: 0, Right: 0, Unknown: 0 };
      if (i >= drumCfg.countIn) {
        const k = i - drumCfg.countIn;
        let side = pattern[k % pattern.length];
        let delay = 0;
        if (k % 5 === 4) delay = 110;                // 늦게
        if (k % 9 === 8) side = side === "Left" ? "Right" : "Left"; // 손 바꿈
        dys[side] = strikeOffset(rel - (i * period + delay));
      }
      const hs = [hand("Left", 0, dys.Left, false), hand("Right", 0.35, dys.Right, false)];
      const st = motion.update(hs, now);
      const scores: Record<string, number> = {};
      for (const k of Object.keys(st.hands)) scores[k] = st.hands[k as Side]!.score;
      drawOverlay(ctx, hs, { mirror: false, silhouette: true, trail: false, trails: {}, fontFamily: font,
        feedback: { scores, events: st.events, now, pulseMs: drumCfg.feedback.pulseMs } });
      setState(st); setHands(hs);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const noop = () => {};
  return (
    <div className="min-h-screen bg-black p-4">
      <div className="section-title mb-2">dev — silhouette + drum simulation (5번째 박 늦게, 9번째 박 손 바꿈)</div>
      <div className="relative aspect-video w-full max-w-[960px] overflow-hidden rounded-[14px] border border-line bg-[#1a1a1a]">
        <canvas ref={ref} className="absolute inset-0 h-full w-full" />
        <LiveBar source="remote" fps={30} hands={hands} mirror={false} silhouette trail={false} onMirror={noop} onSilhouette={noop} onTrail={noop} onDisconnect={noop} />
        {state && <BeatBar state={state} name="드럼" onRestart={noop} onStop={noop} />}
      </div>
      {state && (
        <pre className="mt-3 font-mono text-[11px] text-muted">
          {JSON.stringify({ countIn: state.countIn, step: state.step, accuracy: state.accuracy.toFixed(2), history: state.history.map((h) => `${h.step}${h.side[0]}:${h.result}${h.offsetMs !== undefined ? "@" + Math.round(h.offsetMs) : ""}`) }, null, 1)}
        </pre>
      )}
    </div>
  );
}
