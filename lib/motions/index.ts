// 사용 가능한 모션 목록. 새 모션은 여기 한 줄 추가.
import { DrumMotion } from "./drum";
import type { Motion } from "./types";

export type MotionId = "none" | "drum";

export const MOTIONS: { id: MotionId; name: string; description: string }[] = [
  { id: "none", name: "없음", description: "손만 추적해요" },
  { id: "drum", name: "드럼", description: "박자에 맞춰 R L R L" },
];

export function createMotion(id: MotionId): Motion | null {
  switch (id) {
    case "drum": return new DrumMotion();
    default: return null;
  }
}
