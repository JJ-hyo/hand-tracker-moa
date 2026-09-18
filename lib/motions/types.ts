// "모션" — 트래킹된 손을 정답 동작과 비교해 피드백 상태를 내는 모듈의 공통 인터페이스.
// UI와 분리된 순수 로직. 렌더 루프에서 매 프레임 update()를 부른다.
import type { Side, TrackedHand } from "../types";

export type Result = "good" | "early" | "late" | "miss" | "wrong" | "extra";

/** 순간 이벤트 — 오버레이 링 펄스용 */
export type MotionEvent = {
  t: number;
  side: Side;
  /** 정규화 좌표 (0~1). 손이 안 보여서 위치를 모르면 undefined */
  x?: number;
  y?: number;
  result: Result;
  offsetMs?: number;
};

/** 박자 한 칸의 판정 기록 — BeatBar용 */
export type BeatRecord = { index: number; step: number; side: Side; result: Result; offsetMs?: number };

export type HandFeedback = {
  /** 0(어긋남) ~ 1(정확). 프레임마다 이징돼서 천천히 움직인다 */
  score: number;
  status: Result | "idle";
};

export type MotionState = {
  running: boolean;
  /** 카운트인 중이면 남은 박 수 (4,3,2,1), 아니면 0 */
  countIn: number;
  /** 패턴 안에서의 현재 위치 (0..pattern.length-1) */
  step: number;
  /** 현재 박 안에서의 진행 (0..1) */
  phase: number;
  pattern: Side[];
  bpm: number;
  /** 판정 허용 범위(ms) — BeatBar 점 위치 스케일 */
  okMs: number;
  hands: Partial<Record<Side, HandFeedback>>;
  /** 최근 이벤트 (pulseMs 이내) */
  events: MotionEvent[];
  /** 최근 판정 N개 */
  history: BeatRecord[];
  /** 최근 판정 정확도 0~1 */
  accuracy: number;
};

export type BeatTick = { t: number; accent: boolean; countIn: boolean };

export interface Motion {
  id: string;
  name: string;
  start(now: number): void;
  stop(): void;
  update(hands: TrackedHand[], now: number): MotionState;
  /** 메트로놈 스케줄용 — now 이후 horizonMs 안의 박 */
  upcomingBeats(now: number, horizonMs: number): BeatTick[];
}
