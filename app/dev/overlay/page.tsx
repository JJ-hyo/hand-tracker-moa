"use client";

import { useEffect, useRef } from "react";
import { drawOverlay } from "@/lib/overlay";
import { classify } from "@/lib/gestures";
import type { Landmark, TrackedHand } from "@/lib/types";
import LiveBar from "@/components/LiveBar";

// 카메라 없이 실루엣 오버레이를 확인하는 개발용 페이지 — /dev/overlay
// 정규화 좌표(0~1)로 만든 가짜 손 두 개 (왼손: 펼침, 오른손: 핀치)

const open: Landmark[] = [
  [0.30, 0.86], [0.23, 0.78], [0.18, 0.68], [0.15, 0.60], [0.13, 0.53],
  [0.26, 0.58], [0.25, 0.46], [0.24, 0.38], [0.24, 0.31],
  [0.31, 0.56], [0.31, 0.43], [0.31, 0.34], [0.31, 0.27],
  [0.36, 0.58], [0.37, 0.46], [0.38, 0.38], [0.38, 0.32],
  [0.41, 0.62], [0.43, 0.53], [0.45, 0.46], [0.46, 0.41],
].map(([x, y]) => ({ x, y, z: 0 }));

const pinch: Landmark[] = [
  [0.70, 0.86], [0.64, 0.78], [0.61, 0.68], [0.62, 0.60], [0.66, 0.55],
  [0.68, 0.60], [0.68, 0.53], [0.67, 0.56], [0.66, 0.56],
  [0.73, 0.58], [0.74, 0.46], [0.75, 0.38], [0.75, 0.31],
  [0.78, 0.60], [0.80, 0.49], [0.81, 0.41], [0.82, 0.35],
  [0.82, 0.64], [0.85, 0.56], [0.87, 0.49], [0.88, 0.44],
].map(([x, y]) => ({ x, y, z: 0 }));

const hands: TrackedHand[] = [
  { side: "Left", score: 0.97, landmarks: open, gesture: classify(open) },
  { side: "Right", score: 0.91, landmarks: pinch, gesture: classify(pinch) },
];

export default function OverlayDev() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    c.width = 1280; c.height = 720;
    const ctx = c.getContext("2d")!;
    drawOverlay(ctx, hands, { mirror: false, silhouette: true, trail: false, trails: {}, fontFamily: getComputedStyle(document.body).fontFamily });
  }, []);
  const noop = () => {};
  return (
    <div className="min-h-screen bg-black p-4">
      <div className="section-title mb-2">dev — overlay + live bar preview</div>
      <div className="relative aspect-video w-full max-w-[960px] overflow-hidden rounded-[14px] border border-line bg-[#1a1a1a]">
        <canvas ref={ref} className="absolute inset-0 h-full w-full" />
        <LiveBar source="remote" fps={30} hands={hands} mirror={false} silhouette trail={false} onMirror={noop} onSilhouette={noop} onTrail={noop} onDisconnect={noop} />
      </div>
    </div>
  );
}
