// 로컬 HTTPS 정적 서버 — 폰에서 카메라를 켜려면 HTTPS가 필요함
// 실행: node server.js   →  https://<PC IP>:8443
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const ROOT = __dirname;
const HTTPS_PORT = 8443;
const HTTP_PORT = 8080;
const CERT_DIR = path.join(ROOT, ".cert");
const KEY = path.join(CERT_DIR, "key.pem");
const CERT = path.join(CERT_DIR, "cert.pem");

function lanIps() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
}

function ensureCert() {
  if (fs.existsSync(KEY) && fs.existsSync(CERT)) return;
  fs.mkdirSync(CERT_DIR, { recursive: true });
  const sans = ["DNS:localhost", "IP:127.0.0.1", ...lanIps().map((ip) => `IP:${ip}`)].join(",");
  const cmd = `openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -keyout "${KEY}" -out "${CERT}" -subj "/CN=hand-tracker" -addext "subjectAltName=${sans}"`;
  console.log("자체 서명 인증서 생성 중…");
  execSync(cmd, { stdio: "inherit" });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function handler(req, res) {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  // 뷰어가 QR에 넣을 폰 접속 주소를 알 수 있도록 LAN 주소 제공
  if (p === "/lan.json") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ urls: lanIps().map((ip) => `https://${ip}:${HTTPS_PORT}`) }));
    return;
  }
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end("Not found"); return;
  }
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(file).pipe(res);
}

ensureCert();
https.createServer({ key: fs.readFileSync(KEY), cert: fs.readFileSync(CERT) }, handler).listen(HTTPS_PORT);
http.createServer(handler).listen(HTTP_PORT);

console.log("\n서버 실행 중\n");
console.log(`  PC (뷰어):   http://localhost:${HTTP_PORT}`);
for (const ip of lanIps()) console.log(`  폰 (송신):   https://${ip}:${HTTPS_PORT}/sender.html`);
console.log("\n폰에서 '연결이 비공개로 설정되어 있지 않음' 경고가 뜨면 '고급 → 계속 이동'을 누르세요.\n");
