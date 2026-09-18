"use client";

import dynamic from "next/dynamic";

// MediaPipe / PeerJS는 브라우저 전용 → SSR 제외 (ssr:false는 클라이언트 컴포넌트에서만 허용)
const Viewer = dynamic(() => import("@/components/Viewer"), { ssr: false });

export default function Page() {
  return <Viewer />;
}
