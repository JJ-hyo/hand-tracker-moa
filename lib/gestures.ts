// 랜드마크 → 제스처. 순수 함수. 임계값은 data/gestures.json.
import config from "@/data/gestures.json";
import type { Gesture, Landmark } from "./types";

// 인덱스: 0 손목, 4 엄지끝, 8 검지끝, 12 중지끝, 16 약지끝, 20 소지끝
const TIPS = [8, 12, 16, 20];
const PIPS = [6, 10, 14, 18];

const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);

type GestureKey = keyof typeof config.gestures;

function make(key: GestureKey, detail?: string): Gesture {
  const g = config.gestures[key];
  return { key, name: g.name, emoji: g.emoji, detail: detail ?? g.label };
}

export function classify(lm: Landmark[]): Gesture {
  const wrist = lm[0];
  const palm = dist(wrist, lm[9]) || 1e-6;
  // 손가락 끝이 두번째 관절보다 손목에서 멀면 펴진 것
  const extended = TIPS.map((t, i) => dist(lm[t], wrist) > dist(lm[PIPS[i]], wrist) * config.extendRatio);
  const thumbExt = dist(lm[4], lm[17]) > dist(lm[3], lm[17]) * config.thumbRatio;
  const count = extended.filter(Boolean).length + (thumbExt ? 1 : 0);
  const pinch = dist(lm[4], lm[8]) / palm;

  if (pinch < config.pinchThreshold) return make("pinch", `핀치 ${(pinch * 100).toFixed(0)}%`);
  if (count === 0) return make("fist");
  if (count >= 5) return make("open");
  if (extended[0] && !extended[1] && !extended[2] && !extended[3]) return make("point");
  if (extended[0] && extended[1] && !extended[2] && !extended[3]) return make("peace");
  if (thumbExt && count === 1) return make("thumbs");
  return make("other", `손가락 ${count}개`);
}
