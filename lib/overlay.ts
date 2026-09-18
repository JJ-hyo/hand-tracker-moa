// 캔버스 오버레이 — DESIGN.md §06 "손 오버레이 — 실루엣"
// 뼈대(관절 점 + 선)를 그리지 않고, 21개 랜드마크로 손 전체를 감싸는 실루엣 하나를 그린다.
//   채움: 손 컬러 @ fillOpacity · 외곽선: outlineWidth, 100% · 글로우: glowBlur
//   손가락 두께: 손바닥 폭(wrist↔중지 MCP) × fingerWidthRatio
import settings from "@/data/settings.json";
import type { Side, TrackedHand } from "./types";
import type { MotionEvent, Result } from "./motions/types";

type Pt = { x: number; y: number };
export type Trails = Partial<Record<Side, Pt[]>>;

const O = settings.overlay;

// 손바닥 외곽 폴리곤 (손목 → 엄지 CMC → 각 MCP → 소지 MCP)과 손가락 5개 체인
const PALM = [0, 1, 5, 9, 13, 17];
const FINGERS = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [0, 9, 10, 11, 12],
  [0, 13, 14, 15, 16],
  [0, 17, 18, 19, 20],
];

export function handColor(side: Side) {
  return side === "Left" ? settings.colors.left : settings.colors.right;
}

const DANGER = "#FF5A5F", GRAY = "#8B8F98", ACCENT = "#FFA31A";

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** 모션 점수(1=정확, 0=어긋남)에 따라 손 색을 바꾼다 — 채도가 빠지고 살짝 붉어짐 */
export function feedbackColor(side: Side, score: number) {
  const off = 1 - Math.max(0, Math.min(1, score));
  return mix(mix(handColor(side), GRAY, off * 0.7), DANGER, off * 0.35);
}

export function resultColor(side: Side, r: Result) {
  if (r === "good") return handColor(side);
  if (r === "early" || r === "late" || r === "extra") return ACCENT;
  return DANGER;
}

export type OverlayOptions = {
  mirror: boolean;
  silhouette: boolean;
  trail: boolean;
  trails: Trails;
  /** 라벨 글꼴 패밀리 (Archivo 등 — body의 computed fontFamily를 넘긴다) */
  fontFamily?: string;
  /** 모션 피드백: 손별 점수 + 최근 이벤트(링 펄스) */
  feedback?: { scores: Partial<Record<Side, number>>; events: MotionEvent[]; now: number; pulseMs: number };
};

// 실루엣 합성용 오프스크린 캔버스 (프레임마다 재사용)
let scratch: HTMLCanvasElement | null = null;
function getScratch(w: number, h: number) {
  if (!scratch) scratch = document.createElement("canvas");
  if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h; }
  return scratch;
}

/** 손바닥 폴리곤 + 손가락 체인을 하나의 경로로 */
function buildPaths(px: (i: number) => Pt) {
  const palm = new Path2D();
  PALM.forEach((i, k) => { const p = px(i); k ? palm.lineTo(p.x, p.y) : palm.moveTo(p.x, p.y); });
  palm.closePath();
  const fingers = new Path2D();
  for (const chain of FINGERS) chain.forEach((i, k) => { const p = px(i); k ? fingers.lineTo(p.x, p.y) : fingers.moveTo(p.x, p.y); });
  return { palm, fingers };
}

/**
 * 실루엣 한 개를 오프스크린에 그려 [채움 레이어, 외곽선 레이어]로 합성한다.
 * 외곽선은 "두꺼운 획 − (두께−2·outline) 획"으로 만들어 손가락 사이가 메워지지 않은 한 덩어리 링이 된다.
 */
function drawSilhouette(ctx: CanvasRenderingContext2D, h: TrackedHand, mirror: boolean, color: string) {
  const { width: W, height: H } = ctx.canvas;
  const px = (i: number): Pt => ({ x: h.landmarks[i].x * W, y: h.landmarks[i].y * H });
  const palmWidth = Math.hypot(px(0).x - px(9).x, px(0).y - px(9).y);
  const thick = Math.max(6, palmWidth * O.fingerWidthRatio);
  const { palm, fingers } = buildPaths(px);

  const sc = getScratch(W, H);
  const s = sc.getContext("2d")!;
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.clearRect(0, 0, W, H);
  if (mirror) { s.translate(W, 0); s.scale(-1, 1); }
  s.lineJoin = "round"; s.lineCap = "round";

  // 1) 채움 레이어: 불투명으로 덩어리를 만든 뒤 fillOpacity로 얹는다 (겹침 자국 없음)
  s.globalCompositeOperation = "source-over";
  s.fillStyle = color; s.strokeStyle = color;
  s.lineWidth = thick;
  s.fill(palm); s.stroke(palm); s.stroke(fingers);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = O.fillOpacity; ctx.drawImage(sc, 0, 0); ctx.restore();

  // 2) 외곽선 레이어: 100% 색으로 그린 뒤 안쪽을 지워 outlineWidth 링만 남김
  s.clearRect(0, 0, W, H);
  if (mirror) { s.setTransform(1, 0, 0, 1, 0, 0); s.translate(W, 0); s.scale(-1, 1); }
  s.fillStyle = color; s.strokeStyle = color;
  s.lineWidth = thick + O.outlineWidth * 2;
  s.fill(palm); s.stroke(palm); s.stroke(fingers);
  s.globalCompositeOperation = "destination-out";
  s.lineWidth = thick;
  s.fill(palm); s.stroke(palm); s.stroke(fingers);
  s.globalCompositeOperation = "source-over";
  // 글로우는 링 레이어를 메인에 얹을 때 그림자로
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.shadowColor = color; ctx.shadowBlur = O.glowBlur;
  ctx.drawImage(sc, 0, 0);
  ctx.restore();
}

export function drawOverlay(ctx: CanvasRenderingContext2D, hands: TrackedHand[], opts: OverlayOptions) {
  const { width: W, height: H } = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);

  for (const h of hands) {
    const score = opts.feedback?.scores[h.side];
    const color = score === undefined ? handColor(h.side) : feedbackColor(h.side, score);
    if (opts.silhouette) drawSilhouette(ctx, h, opts.mirror, color);

    if (opts.trail) {
      const t = (opts.trails[h.side] ??= []);
      t.push({ x: h.landmarks[8].x * W, y: h.landmarks[8].y * H });
      if (t.length > O.trailLength) t.shift();
      ctx.save();
      if (opts.mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
      ctx.beginPath();
      t.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.strokeStyle = color; ctx.lineWidth = O.trailWidth; ctx.lineCap = "round"; ctx.globalAlpha = O.trailOpacity;
      ctx.stroke();
      ctx.restore();
    }
  }
  if (!opts.trail) for (const k of Object.keys(opts.trails) as Side[]) opts.trails[k]!.length = 0;

  // 링 펄스: 타격 지점에서 퍼지며 사라진다 (정확=손 색, 빠름/늦음=오렌지, 놓침/손 바뀜=빨강)
  if (opts.feedback) {
    const { events, now, pulseMs } = opts.feedback;
    for (const e of events) {
      if (e.x === undefined || e.y === undefined) continue;
      const age = Math.min(1, (now - e.t) / pulseMs);
      let x = e.x * W; const y = e.y * H;
      if (opts.mirror) x = W - x;
      const r = (H * 0.05) * (0.6 + age * 1.2);
      ctx.save();
      ctx.globalAlpha = (1 - age) * 0.9;
      ctx.strokeStyle = resultColor(e.side, e.result);
      ctx.lineWidth = 3 * (1 - age) + 1;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  // 제스처 라벨: 실루엣 위 labelOffset 지점, 14px/600 대문자 + rgba(0,0,0,.6) pill. 미러와 무관하게 정방향.
  const font = `600 14px ${opts.fontFamily || "system-ui, sans-serif"}`;
  for (const h of hands) {
    const top = Math.min(...h.landmarks.map((l) => l.y)) * H;
    let cx = (h.landmarks.reduce((a, l) => a + l.x, 0) / h.landmarks.length) * W;
    if (opts.mirror) cx = W - cx;
    const text = h.gesture.name.toUpperCase();
    ctx.font = font; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const tw = ctx.measureText(text).width;
    const padX = 10, ph = 24, pw = tw + padX * 2;
    const y = top - O.labelOffset;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath(); ctx.roundRect(cx - pw / 2, y - ph / 2, pw, ph, ph / 2); ctx.fill();
    const score = opts.feedback?.scores[h.side];
    ctx.fillStyle = score === undefined ? handColor(h.side) : feedbackColor(h.side, score);
    ctx.fillText(text, cx, y + 0.5);
  }
}
