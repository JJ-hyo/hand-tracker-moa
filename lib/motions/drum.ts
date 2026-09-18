// 드럼 모션 — 메트로놈 박자에 맞춰 패턴(R L R L …)대로 손을 내리치는지 판정한다.
// 정답은 data/motions/drum.json (BPM, 패턴, 허용 범위)에서 온다.
//
// 스트라이크 감지: 손 위치(손목↔중지MCP 중점)의 세로 속도가 "아래로 빠르게 → 멈춤/반등"하는 순간.
// 1인칭(글라스) 기준이라 손이 아래쪽에서 크게 들어오고 손목이 잘릴 수 있어 손끝 대신 손 중심을 쓴다.
import cfg from "@/data/motions/drum.json";
import type { Side, TrackedHand } from "../types";
import type { BeatRecord, BeatTick, HandFeedback, Motion, MotionEvent, MotionState, Result } from "./types";

type Sample = { t: number; x: number; y: number; palm: number };

class HandTrack {
  last?: Sample;
  vy = 0;            // 세로 속도 (정규화 단위/초, +가 아래)
  topY = Infinity;   // 마지막 타격 이후 가장 높았던 지점
  moving = false;    // 아래로 움직이는 중
  lastStrike = -Infinity;
  fb: HandFeedback = { score: 1, status: "idle" };
  lastSeen?: Sample;
}

const PATTERN = cfg.pattern as Side[];

export class DrumMotion implements Motion {
  id = cfg.id;
  name = cfg.name;
  private t0 = 0;
  private running = false;
  private period = 60000 / cfg.bpm;
  private tracks: Partial<Record<Side, HandTrack>> = {};
  private judged = new Map<number, BeatRecord>();
  private events: MotionEvent[] = [];
  private lastMissCheck = -1;

  start(now: number) {
    this.t0 = now;
    this.running = true;
    this.tracks = {};
    this.judged.clear();
    this.events = [];
    this.lastMissCheck = -1;
  }
  stop() { this.running = false; }

  private beatTime(i: number) { return this.t0 + i * this.period; }
  private expectedSide(i: number): Side { return PATTERN[(i - cfg.countIn) % PATTERN.length]; }

  upcomingBeats(now: number, horizonMs: number): BeatTick[] {
    if (!this.running) return [];
    const from = Math.ceil((now - this.t0) / this.period);
    const to = Math.floor((now + horizonMs - this.t0) / this.period);
    const out: BeatTick[] = [];
    for (let i = Math.max(0, from); i <= to; i++) {
      const countIn = i < cfg.countIn;
      out.push({ t: this.beatTime(i), countIn, accent: !countIn && (i - cfg.countIn) % PATTERN.length === 0 });
    }
    return out;
  }

  private record(i: number, side: Side, result: Result, now: number, offsetMs?: number, pos?: Sample) {
    this.judged.set(i, { index: i, step: (i - cfg.countIn) % PATTERN.length, side, result, offsetMs });
    this.emit(side, result, now, offsetMs, pos);
  }
  private emit(side: Side, result: Result, now: number, offsetMs?: number, pos?: Sample) {
    this.events.push({ t: now, side, result, offsetMs, x: pos?.x, y: pos?.y });
    const tr = this.tracks[side] ?? (this.tracks[side] = new HandTrack());
    tr.fb.status = result;
  }

  /** 타격 한 번을 박자에 대응시켜 판정 */
  private judgeStrike(side: Side, now: number, pos: Sample) {
    const i = Math.round((now - this.t0) / this.period);
    if (i < cfg.countIn) return; // 카운트인 중엔 판정 안 함
    const offset = now - this.beatTime(i);
    if (Math.abs(offset) > cfg.timing.okMs || this.judged.has(i)) {
      this.emit(side, "extra", now, offset, pos); // 박 사이의 헛손질 / 같은 박에 두 번
      return;
    }
    const expected = this.expectedSide(i);
    let result: Result;
    if (side !== expected) result = "wrong";
    else if (Math.abs(offset) <= cfg.timing.goodMs) result = "good";
    else result = offset < 0 ? "early" : "late";
    this.record(i, side, result, now, offset, pos);
  }

  /** 허용 범위가 지났는데 타격이 없는 박 → miss */
  private checkMisses(now: number) {
    const lastDue = Math.floor((now - cfg.timing.okMs - this.t0) / this.period);
    for (let i = Math.max(cfg.countIn, this.lastMissCheck + 1); i <= lastDue; i++) {
      if (!this.judged.has(i)) {
        const side = this.expectedSide(i);
        this.record(i, side, "miss", now, undefined, this.tracks[side]?.lastSeen);
      }
    }
    this.lastMissCheck = Math.max(this.lastMissCheck, lastDue);
  }

  private trackHand(h: TrackedHand, now: number) {
    if (h.side === "Unknown") return;
    const tr = this.tracks[h.side] ?? (this.tracks[h.side] = new HandTrack());
    const a = h.landmarks[0], b = h.landmarks[9];
    const s: Sample = { t: now, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, palm: Math.hypot(a.x - b.x, a.y - b.y) };
    tr.lastSeen = s;
    if (tr.last) {
      const dt = (now - tr.last.t) / 1000;
      if (dt > 0 && dt < 0.3) {
        const v = (s.y - tr.last.y) / dt;
        const k = cfg.strike.velocitySmoothing;
        tr.vy = tr.vy * (1 - k) + v * k;
        const { minVelocity, minDropRatio, debounceMs } = cfg.strike;
        if (tr.vy > minVelocity) tr.moving = true;
        else if (tr.moving && tr.vy <= minVelocity * 0.25) {
          // 감속/반등 → 타격 후보. 충분히 내려왔고 디바운스를 지났을 때만
          tr.moving = false;
          if (s.y - tr.topY >= minDropRatio * s.palm && now - tr.lastStrike > debounceMs) {
            tr.lastStrike = now;
            tr.topY = s.y;
            this.judgeStrike(h.side, now, s);
          }
        }
      } else {
        tr.vy = 0; tr.moving = false; // 잠깐 놓쳤다 돌아옴 — 속도 리셋
      }
    }
    if (!tr.moving) tr.topY = Math.min(tr.topY, s.y);
    tr.last = s;
  }

  update(hands: TrackedHand[], now: number): MotionState {
    const rel = now - this.t0;
    const beatIdx = Math.floor(rel / this.period);
    const inCountIn = beatIdx < cfg.countIn;

    if (this.running) {
      for (const h of hands) this.trackHand(h, now);
      if (!inCountIn) this.checkMisses(now);
    }

    // 손별 score 이징
    const { scoreByResult, scoreEase, pulseMs, historyLength } = cfg.feedback;
    for (const side of ["Left", "Right"] as Side[]) {
      const tr = this.tracks[side];
      if (!tr) continue;
      const target = tr.fb.status === "idle" ? 1 : (scoreByResult as Record<string, number>)[tr.fb.status];
      tr.fb.score += (target - tr.fb.score) * scoreEase;
    }

    this.events = this.events.filter((e) => now - e.t < pulseMs);
    const history = [...this.judged.values()].sort((a, b) => a.index - b.index).slice(-historyLength);
    const acc = history.length
      ? history.reduce((s, r) => s + (r.result === "good" ? 1 : r.result === "early" || r.result === "late" ? 0.5 : 0), 0) / history.length
      : 1;

    const hands_: MotionState["hands"] = {};
    for (const side of ["Left", "Right"] as Side[]) if (this.tracks[side]) hands_[side] = { ...this.tracks[side]!.fb };

    return {
      running: this.running,
      countIn: this.running && inCountIn ? cfg.countIn - beatIdx : 0,
      step: inCountIn ? -1 : (beatIdx - cfg.countIn) % PATTERN.length,
      phase: this.running ? (rel % this.period) / this.period : 0,
      pattern: PATTERN,
      bpm: cfg.bpm,
      okMs: cfg.timing.okMs,
      hands: hands_,
      events: [...this.events],
      history,
      accuracy: acc,
    };
  }
}
