// 뷰어가 QR에 넣을 "폰에서 접속 가능한 주소"를 알려준다 (PC의 LAN IP).
import os from "os";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const { protocol, port } = new URL(req.url);
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((i): i is os.NetworkInterfaceInfo => !!i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
  const urls = ips.map((ip) => `${protocol}//${ip}${port ? `:${port}` : ""}`);
  return NextResponse.json({ urls, secure: protocol === "https:" });
}
