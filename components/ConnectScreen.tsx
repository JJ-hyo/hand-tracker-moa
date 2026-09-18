"use client";

import PairingBox from "./PairingBox";
import { Logo, Motif } from "./Brand";

type Camera = { deviceId: string; label: string };

type Props = {
  status: React.ReactNode;
  modelReady: boolean;
  cameras: Camera[];
  selectedCam: string;
  onSelectCam: (id: string) => void;
  onStartCamera: () => void;
  pairCode: string | null;
  onNewCode: () => void;
  logs: { t: string; msg: string; err: boolean }[];
};

/** 1단계 — 연결. 이 기기 카메라 또는 폰 중 하나를 고른다. */
export default function ConnectScreen(p: Props) {
  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden px-4 pb-16 pt-10 sm:pt-14">
      {/* 장식 모티프 — 디자인 시스템 히어로처럼 오른쪽 위에 큰 오렌지, 주변에 작은 점무늬 */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Motif kind="orange" size={260} className="absolute -right-16 -top-10 opacity-90 sm:right-[6%] sm:top-6" />
        <Motif kind="cyan" size={72} className="absolute right-[24%] top-10 hidden sm:block" />
        <Motif kind="magenta" size={64} className="absolute right-[30%] top-52 hidden opacity-90 sm:block" />
        <Motif kind="green" size={84} className="absolute -left-6 top-[46%] opacity-70 sm:left-[4%]" />
        <Motif kind="cyan" size={48} className="absolute bottom-24 left-[12%] opacity-70" style={{ transform: "rotate(45deg)" }} />
        <Motif kind="magenta" size={44} className="absolute bottom-16 right-[8%] opacity-70" />
      </div>

      <header className="relative mb-10 flex flex-col items-center text-center">
        <Logo width={200} />
        <h1 className="mt-6 text-[30px] font-semibold leading-none tracking-[-0.02em]">연결하기</h1>
        <p className="mt-2 text-[13px] text-muted">{p.status}</p>
      </header>

      <div className="relative grid w-full max-w-[680px] grid-cols-1 gap-4 sm:grid-cols-2">
        {/* 이 기기 카메라 */}
        <section className="panel relative overflow-hidden">
          <Motif kind="cyan" size={40} className="absolute -right-2 -top-2 opacity-60" />
          <div>
            <h2 className="section-title">01 — Local</h2>
            <div className="mt-1.5 text-[15px] font-semibold">이 기기 카메라</div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">PC 웹캠으로 바로 시작해요.</p>
          </div>
          <div>
            <label className="label" htmlFor="cameraSelect">카메라</label>
            <select id="cameraSelect" className="field" value={p.selectedCam} onChange={(e) => p.onSelectCam(e.target.value)}>
              {p.cameras.length === 0 && <option value="">카메라 없음</option>}
              {p.cameras.map((c, i) => (
                <option key={c.deviceId} value={c.deviceId}>{c.label || `카메라 ${i + 1}`}</option>
              ))}
            </select>
          </div>
          <button className="btn mt-auto" disabled={!p.modelReady} onClick={p.onStartCamera}>
            카메라 시작
          </button>
        </section>

        {/* 폰 / 외부 기기 */}
        <section className="panel relative overflow-hidden">
          <Motif kind="magenta" size={40} className="absolute -right-2 -top-2 opacity-60" />
          <div>
            <h2 className="section-title">02 — Remote</h2>
            <div className="mt-1.5 text-[15px] font-semibold">폰 / 외부 기기</div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">폰 카메라 영상을 받아서 트래킹해요. 글라스 연결도 이 자리에 들어와요.</p>
          </div>
          <PairingBox code={p.pairCode} onNewCode={p.onNewCode} />
        </section>
      </div>

      {p.logs.length > 0 && (
        <div className="relative mt-6 w-full max-w-[680px] font-mono text-[11px] leading-[1.9] text-muted">
          {p.logs.slice(0, 4).map((l, i) => (
            <div key={i} className={l.err ? "err" : undefined}>[{l.t}] {l.msg}</div>
          ))}
        </div>
      )}

      <footer className="relative mt-auto flex w-full max-w-[680px] justify-between pt-12 font-mono text-[10px] uppercase tracking-[0.1em] text-dim">
        <span>Motion Archive — Hand Tracker</span>
        <span>Camera first. The UI steps back.</span>
      </footer>
    </div>
  );
}
