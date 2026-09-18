"use client";

import { useEffect, useState } from "react";

/** 폰처럼 콘솔을 못 보는 환경용 — 런타임 오류를 화면 하단에 표시 */
export default function ErrorOverlay() {
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const push = (m: string) => setErrors((e) => [...e.slice(-4), m]);
    const onError = (e: ErrorEvent) => push(`${e.message} (${e.filename?.split("/").pop()}:${e.lineno})`);
    const onReject = (e: PromiseRejectionEvent) => push(`Promise: ${e.reason?.message ?? String(e.reason)}`);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onReject);
    };
  }, []);

  if (!errors.length) return null;
  return (
    <div className="fixed inset-x-2 bottom-2 z-50 rounded-lg border border-danger/60 bg-black/85 p-2 font-mono text-[11px] text-danger">
      {errors.map((m, i) => <div key={i}>{m}</div>)}
    </div>
  );
}
