// Web Audio 메트로놈 — 모션의 박 시각(performance.now 기준)을 받아 클릭음을 미리 예약한다.
// AudioContext는 사용자 제스처 이후에만 만들 수 있으므로 start()는 클릭 핸들러 흐름 안에서 부른다.
import cfg from "@/data/motions/drum.json";
import type { BeatTick } from "./motions/types";

export class Metronome {
  private ctx: AudioContext | null = null;
  private scheduled = new Set<number>();

  async start() {
    this.ctx ??= new AudioContext();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.scheduled.clear();
  }
  stop() { this.scheduled.clear(); }
  close() { this.ctx?.close(); this.ctx = null; }

  /** 매 프레임 호출. now(performance.now)와 오디오 시계를 맞춰 예약 */
  schedule(ticks: BeatTick[], now: number) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    for (const tick of ticks) {
      const key = Math.round(tick.t);
      if (this.scheduled.has(key)) continue;
      this.scheduled.add(key);
      const at = ctx.currentTime + Math.max(0, (tick.t - now) / 1000);
      const { clickHz, accentHz, countInHz, clickMs, gain } = cfg.sound;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.value = tick.countIn ? countInHz : tick.accent ? accentHz : clickHz;
      g.gain.setValueAtTime(gain, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + clickMs / 1000);
      osc.connect(g).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + clickMs / 1000 + 0.01);
    }
    // 오래된 키 정리
    if (this.scheduled.size > 64) for (const k of this.scheduled) if (k < now - 5000) this.scheduled.delete(k);
  }
}
