// 세로로 들어온 카메라 스트림을 캔버스로 90° 돌려 가로 스트림으로 만든다.
// 폰의 화면 회전 잠금이 켜져 있으면 폰을 가로로 들어도 스트림이 세로로 오기 때문에 필요하다.
// (MediaStreamTrack 자체는 회전할 수 없어서 canvas.captureStream을 쓴다)

export type Rotated = { stream: MediaStream; stop: () => void };

/** dir: 1 = 시계방향 90°, -1 = 반시계 90° */
export function rotateStream(src: MediaStream, dir: 1 | -1, fps = 30): Rotated {
  const track = src.getVideoTracks()[0];
  const { width = 720, height = 1280 } = track.getSettings();

  const video = document.createElement("video");
  video.srcObject = src;
  video.muted = true;
  video.playsInline = true;
  video.play().catch(() => {});

  const canvas = document.createElement("canvas");
  canvas.width = height;  // 가로세로 바꿈
  canvas.height = width;
  const ctx = canvas.getContext("2d")!;

  let raf = 0;
  const draw = () => {
    raf = requestAnimationFrame(draw);
    if (video.readyState < 2) return;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (canvas.width !== vh || canvas.height !== vw) { canvas.width = vh; canvas.height = vw; }
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((dir * Math.PI) / 2);
    ctx.drawImage(video, -vw / 2, -vh / 2, vw, vh);
    ctx.restore();
  };
  raf = requestAnimationFrame(draw);

  const stream = canvas.captureStream(fps);
  return {
    stream,
    stop: () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}

/** 트랙이 세로(높이 > 너비)인지 */
export function isPortrait(stream: MediaStream) {
  const { width = 0, height = 0 } = stream.getVideoTracks()[0]?.getSettings() ?? {};
  return height > width;
}
