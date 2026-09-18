// PeerJS 송수신. 브라우저 전용 — useEffect/이벤트 핸들러 안에서만 호출.
import settings from "@/data/settings.json";
import type Peer from "peerjs";
import type { MediaConnection } from "peerjs";

const { idPrefix, codeLength, codeChars } = settings.peer;

export function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(codeLength));
  return Array.from(bytes, (n) => codeChars[n % codeChars.length]).join("");
}
export const peerId = (code: string) => `${idPrefix}${code.toUpperCase()}`;

const errType = (e: unknown) => (e as { type?: string; message?: string }).type ?? (e as Error).message ?? "unknown";

async function newPeer(id?: string): Promise<Peer> {
  const { default: PeerCtor } = await import("peerjs");
  return id ? new PeerCtor(id) : new PeerCtor();
}

export type ListenHandlers = {
  open?: () => void;
  stream: (s: MediaStream, from: string) => void;
  close?: () => void;
  error: (type: string) => void;
};

/** 뷰어: 코드로 대기하고, 기기가 걸어오면 영상을 받는다. 반환값은 정리 함수. */
export async function listenForDevice(code: string, on: ListenHandlers) {
  const peer = await newPeer(peerId(code));
  peer.on("open", () => on.open?.());
  peer.on("call", (call: MediaConnection) => {
    call.answer(); // 뷰어는 영상을 보내지 않음
    call.on("stream", (s) => on.stream(s, call.peer));
    call.on("close", () => on.close?.());
    call.on("error", (e) => on.error(errType(e)));
  });
  peer.on("error", (e) => on.error(errType(e)));
  return () => peer.destroy();
}

export type SendHandlers = {
  connected?: () => void;
  close?: () => void;
  error: (type: string) => void;
};

/** 송신: 코드로 뷰어에 전화를 걸고 스트림을 보낸다. */
export async function sendToViewer(code: string, stream: MediaStream, on: SendHandlers) {
  const peer = await newPeer();
  let call: MediaConnection | undefined;

  peer.on("open", () => {
    call = peer.call(peerId(code), stream);
    if (!call) return on.error("call-failed");
    call.on("close", () => on.close?.());
    call.on("error", (e) => on.error(errType(e)));
    // PeerJS는 call 성립 이벤트가 없어 ICE 상태를 직접 감시
    const watch = setInterval(() => {
      const pc = call?.peerConnection;
      if (!pc) return;
      if (pc.connectionState === "connected") { on.connected?.(); clearInterval(watch); }
      if (pc.connectionState === "failed") { on.error("network-failed"); clearInterval(watch); }
    }, 300);
  });
  peer.on("error", (e) => on.error(errType(e)));
  peer.on("disconnected", () => on.error("server-disconnected"));

  return {
    /** 카메라 전환 시 재연결 없이 트랙만 교체 */
    replaceTrack: async (track: MediaStreamTrack) => {
      const sender = call?.peerConnection?.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(track);
    },
    close: () => {
      call?.close();
      peer.destroy();
    },
  };
}
