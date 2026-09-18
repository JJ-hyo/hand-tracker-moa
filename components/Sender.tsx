"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import settings from "@/data/settings.json";
import { sendToViewer } from "@/lib/peer";

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
  const streamRef = useRef<MediaStream | null>(null);
  const connRef = useRef<Conn | null>(null);
  const wakeRef = useRef<WakeLockSentinel | null>(null);

  const [code, setCode] = useState("");
  const [facing, setFacing] = useState<Facing>("environment"); // 뒷카메라 기본 (글라스 시점과 비슷)
  const [status, setStatus] = useState({ text: "스크립트 로딩 중…", err: false }); // JS 실행되면 "대기"로 바뀜
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [hint, setHint] = useState("이 화면을 켜둔 채로 두세요. 화면이 꺼지면 영상도 멈춥니다.");

  // QR 스캔 경로: /sender?id=ABC123
  useEffect(() => {
    const id = params.get("id");
    if (id) setCode(id.toUpperCase());
    setStatus({ text: "대기", err: false });
  }, [params]);

  const set = (text: string, err = false) => setStatus({ text, err });

  async function startCamera(f: Facing) {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const { width, height, frameRate } = settings.video;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: f }, width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: frameRate } },
    });
    streamRef.current = stream;
    if (previewRef.current) previewRef.current.srcObject = stream;
    return stream;
  }

  async function requestWakeLock() {
    try { wakeRef.current = (await navigator.wakeLock?.request("screen")) ?? null; } catch {}
  }

  function cleanup(stopStream = true) {
    connRef.current?.close();
    connRef.current = null;
    if (stopStream) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (previewRef.current) previewRef.current.srcObject = null;
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
      connected: () => { set("송신 중 ✓"); setConnected(true); },
      close: () => { set("연결 종료"); cleanup(false); },
      error: (type) => { set(ERROR_TEXT[type] ?? `오류: ${type}`, true); if (type === "peer-unavailable") setBusy(false); },
    });
    await requestWakeLock();
  }

  async function flip() {
    const next: Facing = facing === "environment" ? "user" : "environment";
    try {
      const s = await startCamera(next);
      setFacing(next);
      await connRef.current?.replaceTrack(s.getVideoTracks()[0]); // 재연결 없이 트랙 교체
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

  return (
    <div className="flex min-h-screen flex-col text-[15px]">
      <div className="relative min-h-[50vh] flex-1 bg-black">
        <video
          ref={previewRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
          style={{ transform: facing === "user" ? "scaleX(-1)" : "none" }}
        />
        <div className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1.5 text-xs">
          상태: <b className={status.err ? "text-danger" : "text-accent"}>{status.text}</b>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-line bg-panel p-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div>
          <label className="label" htmlFor="code">연결 코드 (PC 화면에 표시된 {settings.peer.codeLength}자리)</label>
          <input
            id="code"
            className="field p-3 text-center text-xl uppercase tracking-[0.2em]"
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
          <button className="btn btn-secondary p-3 rounded-[10px]" onClick={flip} disabled={!busy}>카메라 전환</button>
          <button className="btn btn-secondary p-3 rounded-[10px]" onClick={() => { cleanup(); set("대기"); }} disabled={!busy && !connected}>연결 끊기</button>
        </div>
        <div className="text-xs text-muted">{hint}</div>
      </div>
    </div>
  );
}
