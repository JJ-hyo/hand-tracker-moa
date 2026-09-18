# Hand Tracker

카메라 영상(폰 → 최종적으로 스마트 글라스)을 웹에 띄우고, 화면 위의 손을 실시간 트래킹하는 웹앱.
고려대 제품개발 수업 프로젝트.

## 스택

- **Next.js (App Router) + TypeScript + Tailwind CSS**
- 손 트래킹: `@mediapipe/tasks-vision` HandLandmarker (브라우저 GPU, 서버 없음)
- 기기 간 영상 전송: WebRTC, 시그널링은 PeerJS 공개 서버
- 데이터: **로컬 JSON 파일** (`/data/*.json`). 설정, 제스처 정의, 세션 기록 등 전부 파일로.
- 패키지 매니저: npm

## 지금 하지 않는 것

- 배포 (Vercel 등) — 로컬 `npm run dev`만
- DB / 백엔드 API 연동 — JSON 파일로 대체
- 인증, 계정
- 라이트 테마 — 다크 고정 (`DESIGN.md` 참고)

## 현재 상태 (2026-09-19)

Next.js 전환 **완료**. 바닐라 프로토타입은 `legacy/`에 참고용으로만 남아 있음 (실행 안 함, 곧 삭제 예정).

```
app/
  page.tsx              PC 뷰어 (Viewer를 ssr:false로 로드)
  sender/page.tsx       폰 송신 (/sender?id=CODE)
  api/lan/route.ts      PC의 LAN 주소 반환 → QR에 넣을 폰 접속 주소
  layout.tsx, globals.css   (globals.css에 DESIGN.md 토큰을 @theme로 등록)
components/
  Viewer.tsx            뷰어 상태 머신 — 소스 연결 / 렌더 루프 / 1·2단계 화면 전환
  ConnectScreen.tsx     1단계: 연결 (PC 카메라 | 폰 페어링)
  LiveBar.tsx           2단계: 영상 위 상단 얇은 조작 바 (해제·fps·손 칩·토글)
  Stage.tsx             video + canvas 오버레이 (fill 모드면 화면 꽉 채움)
  PairingBox.tsx        코드 / QR / 접속 주소 UI (순수 표시)
  Sender.tsx            폰 송신 화면
lib/
  usePairing.ts         PeerJS 수신 대기 훅 — Viewer에 붙어 화면 전환에도 살아있음
  tracking.ts           HandLandmarker 로드 / detect 래퍼
  gestures.ts           제스처 분류 (순수 함수)
  overlay.ts            캔버스 그리기
  peer.ts               PeerJS 송수신 (listenForDevice / sendToViewer)
  types.ts
data/
  gestures.json         제스처 이름/이모지/임계값
  settings.json         영상·트래킹·오버레이·컬러·페어링 설정
legacy/                 전환 전 바닐라 HTML (참고용)
```

- 화면은 **2단계**: ① 연결(ConnectScreen) → ② 라이브(Stage 전체화면 + LiveBar). `source !== "none"`이면 ②.
- `<video>`는 한 번만 마운트돼야 하므로 Stage는 항상 렌더하고 ①에서는 투명하게 숨김. PeerJS 대기도 같은 이유로 `usePairing`이 Viewer에 붙어 있음.
- 영상 파이프라인은 **소스 → 트래킹 → 오버레이** 3층. 소스(로컬 카메라 / WebRTC 원격 / 나중에 글라스)만 바뀌고 `Viewer.attachStream()` 이후는 동일.
- MediaPipe, PeerJS는 브라우저 전용 → `lib/`에서 동적 `import()`, 페이지는 `dynamic(..., { ssr: false })`.
- 설정값을 바꿀 땐 코드가 아니라 `data/*.json`을 수정.

## 실행

```bash
npm run dev        # HTTPS. PC: https://localhost:3000 / 폰: https://<PC IP>:3000/sender
npm run dev:http   # HTTP (PC 단독 테스트용, 폰 카메라는 안 켜짐)
npm run typecheck
```

- `--experimental-https`가 첫 실행 때 mkcert로 인증서를 만들어 `certificates/`에 둔다 (gitignore됨). 폰에선 최초 접속 시 보안 경고 → "고급 → 계속".
- 폰 카메라는 HTTPS에서만 켜진다.

## 코딩 규칙

- UI 색/간격/타이포는 `DESIGN.md` 토큰을 따른다. Tailwind 설정에 토큰을 등록해서 쓰고, 임의 hex 남발 금지.
- 제스처 분류는 순수 함수로 두고 UI와 분리 (테스트 가능하게).
- 한국어 UI, 해요체. 로그/콘솔은 원어 그대로 가능.
- 새 의존성은 꼭 필요할 때만. 현재 필수: `next`, `react`, `typescript`, `tailwindcss`, `@mediapipe/tasks-vision`, `peerjs`, `qrcode`.

## 알려진 이슈

- 자체 서명 인증서라 폰에서 최초 접속 시 보안 경고 → "고급 → 계속" 필요.
- Ray-Ban Meta 등 폐쇄형 글라스는 서드파티 스트림 불가. 글라스 기종 미정 상태라 폰으로 대체 개발 중.
