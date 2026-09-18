"use client";

import type { RefObject } from "react";

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  mirror: boolean;
  /** true면 부모 영역을 꽉 채움 (라이브 화면), false면 16:9 카드 */
  fill?: boolean;
};

/** video + canvas 오버레이 (design.md §4) */
export default function Stage({ videoRef, canvasRef, mirror, fill = false }: Props) {
  return (
    <div className={fill ? "absolute inset-0 bg-black" : "relative aspect-video max-w-full overflow-hidden rounded-[14px] border border-line bg-black"}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-contain"
        style={{ transform: mirror ? "scaleX(-1)" : "none" }}
      />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
    </div>
  );
}
