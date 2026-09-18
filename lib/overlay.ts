// 캔버스 오버레이 — design.md §6
import settings from "@/data/settings.json";
import type { Connection } from "./tracking";
import type { Side, TrackedHand } from "./types";

type Pt = { x: number; y: number };
export type Trails = Partial<Record<Side, Pt[]>>;

export function handColor(side: Side) {
  return side === "Left" ? settings.colors.left : settings.colors.right;
}

export type OverlayOptions = {
  mirror: boolean;
  skeleton: boolean;
  trail: boolean;
  trails: Trails;
};

export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  hands: TrackedHand[],
  connections: Connection[],
  opts: OverlayOptions,
) {
  const { width: W, height: H } = ctx.canvas;
  const { lineWidth, landmarkRadius, trailLength } = settings.overlay;
  ctx.clearRect(0, 0, W, H);

  ctx.save();
  if (opts.mirror) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }

  for (const h of hands) {
    const color = handColor(h.side);
    const px = (i: number): Pt => ({ x: h.landmarks[i].x * W, y: h.landmarks[i].y * H });

    if (opts.skeleton) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      for (const c of connections) {
        const a = px(c.start), b = px(c.end);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      for (let i = 0; i < h.landmarks.length; i++) {
        const p = px(i);
        ctx.beginPath();
        ctx.arc(p.x, p.y, landmarkRadius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    if (opts.trail) {
      const t = (opts.trails[h.side] ??= []);
      t.push(px(8));
      if (t.length > trailLength) t.shift();
      ctx.beginPath();
      t.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.7;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
  if (!opts.trail) for (const k of Object.keys(opts.trails) as Side[]) opts.trails[k]!.length = 0;

  // 이모지는 미러 변환 없이 정방향으로
  for (const h of hands) {
    let x = h.landmarks[8].x * W;
    const y = h.landmarks[8].y * H;
    if (opts.mirror) x = W - x;
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(h.gesture.emoji, x, y - 24);
    ctx.fillStyle = "#fff";
    ctx.fillText(h.gesture.emoji, x - 1, y - 25);
  }
}
