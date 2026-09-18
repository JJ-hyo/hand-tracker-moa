"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import settings from "@/data/settings.json";
import { createTracker, type Tracker } from "@/lib/tracking";
import { drawOverlay, type Trails } from "@/lib/overlay";
import { usePairing } from "@/lib/usePairing";
import type { SourceKind, TrackedHand } from "@/lib/types";
import Stage from "./Stage";
import ConnectScreen from "./ConnectScreen";
import LiveBar from "./LiveBar";

type LogLine = { t: string; msg: string; err: boolean };
type Camera = { deviceId: string; label: string };

export default function Viewer() {
  // --- refs (렌더 루프에서 쓰는 것들은 state 대신 ref) ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackerRef = useRef<Tracker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(-1);
  const trailsRef = useRef<Trails>({});
  const fpsRef = useRef({ frames: 0, t: performance.now(), fps: 0 });
  const optsRef = useRef({ mirror: true, skeleton: true, trail: false });

  // --- state ---
  const [modelReady, setModelReady] = useState(false);
  const [status, setStatus] = useState<React.ReactNode>("모델 로딩 중…");
  const [source, setSource] = useState<SourceKind>("none");
  const [hands, setHands] = useState<TrackedHand[]>([]);
  const [fps, setFps] = useState(0);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCam, setSelectedCam] = useState("");
  const [mirror, setMirror] = useState(true);
  const [skeleton, setSkeleton] = useState(true);
  const [trail, setTrail] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);

  useEffect(() => { optsRef.current = { mirror, skeleton, trail }; }, [mirror, skeleton, trail]);

  const log = useCallback((msg: string, err = false) => {
    setLogs((l) => [{ t: new Date().toLocaleTimeString(), msg, err }, ...l].slice(0, 100));
    if (err) console.error(msg); else console.log(msg);
  }, []);

  // --- 카메라 목록 ---
  const refreshCameras = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === "videoinput").map((d) => ({ deviceId: d.deviceId, label: d.label }));
    setCameras(cams);
    setSelectedCam((prev) => prev || cams[0]?.deviceId || "");
  }, []);

  // --- 모델 로드 ---
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("이 브라우저는 카메라를 지원하지 않습니다");
      log("getUserMedia 미지원. HTTPS 또는 localhost에서 열어야 합니다.", true);
      return;
    }
    refreshCameras().catch(() => {});
    navigator.mediaDevices.addEventListener("devicechange", refreshCameras);

    let tracker: Tracker | null = null;
    createTracker()
      .then((t) => {
        tracker = t;
        trackerRef.current = t;
        setModelReady(true);
        setStatus(<>모델 준비 완료 · <b className="text-accent">카메라를 시작하세요</b></>);
        log(`HandLandmarker 로드 완료 (${settings.tracking.delegate})`);
      })
      .catch((e: Error) => {
        setStatus("모델 로딩 실패");
        log(`모델 로딩 실패: ${e.message}`, true);
      });

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", refreshCameras);
      tracker?.close();
      trackerRef.current = null;
    };
  }, [log, refreshCameras]);

  // --- 렌더 루프: 소스 → 트래킹 → 오버레이 ---
  const tick = useCallback(() => {
    rafRef.current = requestAnimationFrame(tick);
    const video = videoRef.current, canvas = canvasRef.current, tracker = trackerRef.current;
    if (!video || !canvas || !tracker || video.readyState < 2) return;
    if (video.currentTime === lastTimeRef.current) return;
    lastTimeRef.current = video.currentTime;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const { mirror, skeleton, trail } = optsRef.current;
    const detected = tracker.detect(video, mirror);
    const ctx = canvas.getContext("2d");
    if (ctx) drawOverlay(ctx, detected, tracker.connections, { mirror, skeleton, trail, trails: trailsRef.current });

    const f = fpsRef.current;
    f.frames++;
    const now = performance.now();
    if (now - f.t >= 1000) { f.fps = f.frames; f.frames = 0; f.t = now; setFps(f.fps); }

    setHands(detected);
  }, []);

  const startLoop = useCallback(() => { if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick); }, [tick]);
  const stopLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTimeRef.current = -1;
  }, []);

  // --- 소스 연결/해제 (로컬 카메라든 원격 스트림이든 여기로 들어옴) ---
  const attachStream = useCallback(async (stream: MediaStream, kind: SourceKind) => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = stream;
    const video = videoRef.current!;
    video.srcObject = stream;
    await new Promise<void>((res) => { video.onloadedmetadata = () => res(); });
    await video.play();
    setSource(kind);
    setMirror(kind === "local"); // 외부 기기(폰/글라스)는 뒷카메라 시점 → 반전 안 함
    const track = stream.getVideoTracks()[0];
    const s = track.getSettings();
    log(`소스 연결(${kind}): ${track.label || "unknown"} ${s.width}x${s.height}@${Math.round(s.frameRate || 0)}fps`);
    startLoop();
  }, [log, startLoop]);

  const stopSource = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    stopLoop();
    const c = canvasRef.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setSource("none");
    setHands([]);
    setStatus(<>모델 준비 완료 · <b className="text-accent">카메라를 시작하세요</b></>);
    log("소스 정지");
  }, [log, stopLoop]);

  const startCamera = useCallback(async (deviceId?: string) => {
    const { width, height } = settings.video;
    const video: MediaTrackConstraints = deviceId
      ? { deviceId: { exact: deviceId }, width: { ideal: width }, height: { ideal: height } }
      : { facingMode: "user", width: { ideal: width }, height: { ideal: height } };
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
      await attachStream(stream, "local");
      await refreshCameras(); // 권한을 얻은 뒤에야 label이 채워짐
    } catch (e) {
      const err = e as DOMException;
      log(`카메라 오류: ${err.name} — ${err.message}`, true);
      setStatus("카메라 접근 실패");
    }
  }, [attachStream, log, refreshCameras]);

  useEffect(() => () => { stopLoop(); streamRef.current?.getTracks().forEach((t) => t.stop()); }, [stopLoop]);

  const sourceRef = useRef<SourceKind>("none");
  sourceRef.current = source;
  const pairing = usePairing({
    onStream: (s) => attachStream(s, "remote"),
    onClose: () => { if (sourceRef.current === "remote") stopSource(); },
    log,
  });

  // 1단계: 연결 / 2단계: 라이브. 비디오 엘리먼트는 한 번만 마운트돼야 하므로
  // Stage는 항상 렌더하고, 연결 전에는 화면 밖에 숨긴다.
  const live = source !== "none";

  return (
    <div className="relative min-h-screen">
      <div className={live ? "fixed inset-0" : "pointer-events-none fixed inset-0 opacity-0"} aria-hidden={!live}>
        <Stage videoRef={videoRef} canvasRef={canvasRef} mirror={mirror} fill />
        {live && (
          <LiveBar
            source={source}
            fps={fps}
            hands={hands}
            mirror={mirror}
            skeleton={skeleton}
            trail={trail}
            onMirror={setMirror}
            onSkeleton={setSkeleton}
            onTrail={setTrail}
            onDisconnect={stopSource}
          />
        )}
      </div>

      {!live && (
        <ConnectScreen
          status={status}
          modelReady={modelReady}
          cameras={cameras}
          selectedCam={selectedCam}
          onSelectCam={setSelectedCam}
          onStartCamera={() => startCamera(selectedCam || undefined)}
          pairCode={pairing.code}
          onNewCode={pairing.newCode}
          logs={logs}
        />
      )}
    </div>
  );
}
