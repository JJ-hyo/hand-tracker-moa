"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import settings from "@/data/settings.json";
import { sendToViewer } from "@/lib/peer";
import { isPortrait, rotateStream, type Rotated } from "@/lib/rotateStream";

type Facing = "environment" | "user";
type Conn = Awaited<ReturnType<typeof sendToViewer>>;

const ERROR_TEXT: Record<string, string> = {
  "peer-unavailable": "PC에서 '폰 연결'을 먼저 눌러주세요",
  "network-failed": "연결 실패 (네트워크)",
  "server-disconnected": "서버 연결 끊김",
};

/** 폰 송신 페이지 — 카메라 켜서 PeerJS로 뷰어에 전송 */
export default function Sender() {
  const params = useSearchParams();
  const previewRef = useRef<HTMLVideoElement>(null);
  const rawRef = useRef<MediaStream | null>(null);     // 카메라 원본
  const rotatedRef = useRef<Rotated | null>(null);     // 가로 모드용 회전 스트림
  const connRef = useRef<Conn | null>(null);
  const wakeRef = useRef<WakeLockSentinel | null>(null);

  const [code, setCode] = useState("");
  const [facing, setFacing] = useState<Facing>("environment"); // 뒷카메라 기본 (글라스 시점과 비슷)
  const [landscape, setLandscape] = useState(true);            // 가로 모드 기본 (글라스는 가로)
  const [rotDir, setRotDir] = useState<1 | -1>(1);
  const [rotating, setRotating] = useState(false);             // 실제로 회전이 적용됐는지
  const [status, setStatus] = useState({ text: "스크립트 로딩 중…", err: false }); // JS 실행되면 "대기"로 바뀜
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [hint, setHint] = useState("이 화면을 켜둔 채로 두세요. 화면이 꺼지면 영상도 멈춥니다.");

  // QR 스캔 경로: /sender?id=ABC123
  useEffect(() => {
    const id = params.get("id");
    if (id) setCode(id.toUpperCase());
    setStatus({ text: "대기", err: false });
    try {
      const d = localStorage.getItem("ht-rotDir");
      if (d === "-1") setRotDir(-1);
      if (localStorage.getItem("ht-landscape") === "0") setLandscape(false);
    } catch {}
  }, [params]);

  const set = (text: string, err = false) => setStatus({ text, err });

  /** 카메라를 켜고, 가로 모드면 세로 스트림을 회전시켜 "보낼 스트림"을 만든다 */
  async function startCamera(f: Facing, ls = landscape, dir = rotDir): Promise<MediaStream> {
    rotatedRef.current?.stop(); rotatedRef.current = null;
    rawRef.current?.getTracks().forEach((t) => t.stop());
    const { width, height, frameRate } = settings.video;
    const raw = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: f }, width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: frameRate } },
    });
    rawRef.current = raw;

    let out = raw;
    const needRotate = ls && isPortrait(raw);
    if (needRotate) {
      rotatedRef.current = rotateStream(raw, dir, frameRate);
      out = rotatedRef.current.stream;
    }
    setRotating(needRotate);
    if (previewRef.current) previewRef.current.srcObject = out;
    return out;
  }

  async function requestWakeLock() {
    try { wakeRef.current = (await navigator.wakeLock?.request("screen")) ?? null; } catch {}
  }

  function cleanup(stopStream = true) {
    connRef.current?.close();
    connRef.current = null;
    if (stopStream) {
      rotatedRef.current?.stop(); rotatedRef.current = null;
      rawRef.current?.getTracks().forEach((t) => t.stop()); rawRef.current = null;
      if (previewRef.current) previewRef.current.srcObject = null;
      setRotating(false);
    }
    wakeRef.current?.release().catch(() => {});
    wakeRef.current = null;
    setConnected(false);
    setBusy(false);
  }

  async function connect() {
    const c = code.trim().toUpperCase();
    if (c.length !== settings.peer.codeLength) return set(`코드 ${settings.peer.codeLength}자리를 입력하세요`, true);
    setBusy(true);

    let stream: MediaStream;
    try {
      set("카메라 켜는 중…");
      stream = await startCamera(facing);
    } catch (e) {
      set(`카메라 실패: ${(e as DOMException).name}`, true);
      setHint(window.isSecureContext ? "카메라 권한을 허용해 주세요." : "카메라는 HTTPS 주소에서만 켜집니다. PC에 표시된 주소를 확인하세요.");
      setBusy(false);
      return;
    }

    set("PC에 연결 중…");
    connRef.current = await sendToViewer(c, stream, {
      connected: () => { set("송신 중"); setConnected(true); },
      close: () => { set("연결 종료"); cleanup(false); },
      error: (type) => { set(ERROR_TEXT[type] ?? `오류: ${type}`, true); if (type === "peer-unavailable") setBusy(false); },
    });
    await requestWakeLock();
  }

  /** 카메라/방향 설정을 바꾸고, 통화 중이면 재연결 없이 트랙만 교체 */
  async function reconfigure(f: Facing, ls: boolean, dir: 1 | -1) {
    try {
      const s = await startCamera(f, ls, dir);
      setFacing(f); setLandscape(ls); setRotDir(dir);
      try { localStorage.setItem("ht-landscape", ls ? "1" : "0"); localStorage.setItem("ht-rotDir", String(dir)); } catch {}
      await connRef.current?.replaceTrack(s.getVideoTracks()[0]);
    } catch (e) {
      set(`전환 실패: ${(e as DOMException).name}`, true);
    }
  }

  // 탭 복귀 시 wake lock 재요청
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible" && connRef.current) requestWakeLock(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = busy || connected;

  return (
    <div className="flex min-h-screen flex-col text-[15px]">
      <div className="relative min-h-[50vh] flex-1 bg-black">
        <video
          ref={previewRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-contain"
          style={{ transform: facing === "user" && !rotating ? "scaleX(-1)" : "none" }}
        />
        <div className={`absolute left-3 top-3 rounded-full border bg-black/60 px-3 py-1.5 text-xs ${status.err ? "border-danger/35 text-danger" : connected ? "border-line text-text" : "border-line text-muted"}`}>
          {status.text}{connected && <b className="ml-1 text-accent">✓</b>}
        </div>
        {active && (
          <div className="absolute right-3 top-3 rounded-full border border-line bg-black/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
            {landscape ? (rotating ? "가로 · 회전됨" : "가로") : "세로"}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-line bg-panel p-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div>
          <label className="label" htmlFor="code">연결 코드 (PC 화면에 표시된 {settings.peer.codeLength}자리)</label>
          <input
            id="code"
            className="field p-3 text-center text-lg uppercase tracking-[0.2em]"
            maxLength={settings.peer.codeLength}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="ABC123"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={busy}
          />
        </div>
        <button className="btn p-3 rounded-[10px]" onClick={connect} disabled={busy}>카메라 켜고 연결</button>
        <div className="flex gap-2">
          <button className="btn btn-secondary p-3 rounded-[10px]" onClick={() => reconfigure(facing === "environment" ? "user" : "environment", landscape, rotDir)} disabled={!active}>카메라 전환</button>
          <button className="btn btn-secondary p-3 rounded-[10px]" onClick={() => { cleanup(); set("대기"); }} disabled={!active}>연결 끊기</button>
        </div>
        <div className="flex gap-2">
          <button
            className={`btn btn-secondary p-3 rounded-[10px] ${landscape ? "border-accent/60 text-accent" : ""}`}
            onClick={() => reconfigure(facing, !landscape, rotDir)}
            disabled={!active}
            aria-pressed={landscape}
          >
            가로 모드 {landscape ? "켜짐" : "꺼짐"}
          </button>
          <button
            className="btn btn-secondary p-3 rounded-[10px]"
            onClick={() => reconfigure(facing, landscape, rotDir === 1 ? -1 : 1)}
            disabled={!active || !rotating}
            title="영상이 거꾸로 보이면 누르세요"
          >
            ↻ 회전 방향
          </button>
        </div>
        <div className="text-xs text-muted">
          {hint}
          {rotating && " 영상이 거꾸로 보이면 '회전 방향'을 누르세요."}
        </div>
      </div>
    </div>
  );
}
