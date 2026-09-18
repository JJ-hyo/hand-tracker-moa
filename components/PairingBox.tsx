"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

type Props = {
  code: string | null;
  onNewCode: () => void;
};

const isLocalhost = (u: string) => /^(https?:\/\/)?(localhost|127\.0\.0\.1)/.test(u);

/** 페어링 UI — 코드, QR, 접속 주소. PeerJS 대기는 Viewer의 usePairing이 담당. */
export default function PairingBox({ code, onNewCode }: Props) {
  const [baseUrl, setBaseUrl] = useState("");
  const [insecure, setInsecure] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 기본 접속 주소: 서버가 알려주는 LAN 주소 > 현재 origin
  useEffect(() => {
    setBaseUrl(location.origin);
    fetch("/api/lan")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { urls?: string[]; secure?: boolean } | null) => {
        if (d?.urls?.length) setBaseUrl(d.urls[0]);
        if (d && d.secure === false) setInsecure(true);
      })
      .catch(() => {});
  }, []);

  const base = baseUrl.replace(/\/+$/, "");

  useEffect(() => {
    if (!code || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, `${base}/sender?id=${code}`, { width: 160, margin: 0, errorCorrectionLevel: "M" }).catch(() => {});
  }, [code, base]);

  return (
    <div className="flex flex-col gap-2.5">
      <button className="btn btn-secondary" onClick={onNewCode}>
        {code ? "코드 새로 만들기" : "폰 연결하기"}
      </button>

      {code && (
        <div className="text-center">
          <div className="inline-block rounded-[12px] bg-text p-2.5">
            <canvas ref={canvasRef} className="block" />
          </div>
          <div className="mt-3 text-[30px] font-semibold tracking-[0.2em] tabular-nums">{code}</div>
          <div className="mt-1.5 text-xs leading-relaxed text-muted">
            {isLocalhost(base) ? (
              <><span className="err">localhost 주소는 폰에서 열 수 없어요.</span> 아래에 PC의 IP(예: https://192.168.0.10:3000)를 넣으세요.</>
            ) : insecure ? (
              <><span className="err">HTTP라 폰 카메라가 켜지지 않아요.</span> <code>npm run dev</code>(HTTPS)로 실행하세요.</>
            ) : (
              <>폰으로 QR을 찍거나, <code className="font-mono">{base}/sender</code> 에서 코드를 입력하세요</>
            )}
          </div>
          <div className="mt-2 text-left">
            <label className="label" htmlFor="baseUrl">폰에서 접속할 주소</label>
            <input id="baseUrl" className="field text-xs" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} spellCheck={false} />
          </div>
        </div>
      )}
    </div>
  );
}
