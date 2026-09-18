// MediaPipe HandLandmarker 래퍼. 브라우저 전용 — 클라이언트 컴포넌트의 useEffect 안에서만 호출.
import settings from "@/data/settings.json";
import type { HandLandmarker as HandLandmarkerT } from "@mediapipe/tasks-vision";
import { classify } from "./gestures";
import type { Side, TrackedHand } from "./types";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export type Connection = { start: number; end: number };

export type Tracker = {
  detect: (video: HTMLVideoElement, mirror: boolean) => TrackedHand[];
  connections: Connection[];
  close: () => void;
};

export async function createTracker(): Promise<Tracker> {
  const { HandLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(WASM);
  const t = settings.tracking;
  const lm: HandLandmarkerT = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL, delegate: t.delegate as "GPU" | "CPU" },
    runningMode: "VIDEO",
    numHands: t.numHands,
    minHandDetectionConfidence: t.minHandDetectionConfidence,
    minHandPresenceConfidence: t.minHandPresenceConfidence,
    minTrackingConfidence: t.minTrackingConfidence,
  });

  return {
    connections: HandLandmarker.HAND_CONNECTIONS,
    close: () => lm.close(),
    detect(video, mirror) {
      const r = lm.detectForVideo(video, performance.now());
      return r.landmarks.map((landmarks, i) => {
        // handedness는 "카메라가 본" 기준 → 미러면 실제 손 기준으로 뒤집음
        let side = (r.handedness[i]?.[0]?.categoryName ?? "Unknown") as Side;
        if (mirror && side !== "Unknown") side = side === "Left" ? "Right" : "Left";
        return { side, score: r.handedness[i]?.[0]?.score ?? 0, landmarks, gesture: classify(landmarks) };
      });
    },
  };
}
