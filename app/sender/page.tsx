import { Suspense } from "react";
import Sender from "@/components/Sender";
import ErrorOverlay from "@/components/ErrorOverlay";

// Sender는 브라우저 API를 이벤트/이펙트 안에서만 쓰므로 SSR 가능.
// 서버에서 먼저 그려야 폰에서 JS가 실패해도 화면이 검게만 뜨지 않는다.
export default function SenderPage() {
  return (
    <>
      <Suspense fallback={<div className="p-4 text-xs text-muted">불러오는 중…</div>}>
        <Sender />
      </Suspense>
      <ErrorOverlay />
    </>
  );
}
