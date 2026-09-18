"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listenForDevice, makeCode } from "./peer";

type Handlers = {
  onStream: (s: MediaStream) => void;
  onClose: () => void;
  log: (msg: string, isErr?: boolean) => void;
};

/**
 * 폰/외부 기기 페어링 상태. Viewer에 붙어서 연결 화면 ↔ 라이브 화면 전환과 무관하게
 * PeerJS 대기가 유지되도록 한다 (컴포넌트가 언마운트되면 통화가 끊기므로).
 */
export function usePairing(h: Handlers) {
  const [code, setCode] = useState<string | null>(null);
  const hRef = useRef(h);
  hRef.current = h;

  const newCode = useCallback(() => setCode(makeCode()), []);

  useEffect(() => {
    if (!code) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    listenForDevice(code, {
      open: () => hRef.current.log(`페어링 대기: 코드 ${code}`),
      stream: (s, from) => {
        hRef.current.log(`기기 연결됨 (${from})`);
        hRef.current.onStream(s);
      },
      close: () => {
        hRef.current.log("기기 연결 종료");
        hRef.current.onClose();
      },
      error: (type) => {
        if (type === "unavailable-id") {
          hRef.current.log("코드 충돌, 새로 생성");
          setCode(makeCode());
        } else hRef.current.log(`PeerJS 오류: ${type}`, true);
      },
    }).then((c) => (cancelled ? c() : (cleanup = c)));
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [code]);

  return { code, newCode };
}
