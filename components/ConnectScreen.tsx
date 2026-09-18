"use client";

import PairingBox from "./PairingBox";

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
    <div className="flex min-h-screen flex-col items-center px-4 py-8">
      <header className="mb-8 text-center">
        <div className="section-title mb-1.5">Hand Tracker</div>
        <h1 className="text-[30px] font-semibold leading-none tracking-[-0.02em]">연결하기</h1>
        <p className="mt-2 text-[13px] text-muted">{p.status}</p>
      </header>

      <div className="grid w-full max-w-[680px] grid-cols-1 gap-4 sm:grid-cols-2">
        {/* 이 기기 카메라 */}
        <section className="panel">
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
        <section className="panel">
          <div>
            <h2 className="section-title">02 — Remote</h2>
            <div className="mt-1.5 text-[15px] font-semibold">폰 / 외부 기기</div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">폰 카메라 영상을 받아서 트래킹해요. 글라스 연결도 이 자리에 들어와요.</p>
          </div>
          <PairingBox code={p.pairCode} onNewCode={p.onNewCode} />
        </section>
      </div>

      {p.logs.length > 0 && (
        <div className="mt-6 w-full max-w-[680px] font-mono text-[11px] leading-[1.9] text-muted">
          {p.logs.slice(0, 4).map((l, i) => (
            <div key={i} className={l.err ? "err" : undefined}>[{l.t}] {l.msg}</div>
          ))}
        </div>
      )}
    </div>
  );
}
