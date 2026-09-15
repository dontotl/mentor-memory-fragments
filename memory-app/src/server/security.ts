import { randomBytes } from "node:crypto";
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function checkOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  // Next may normalize req.url to localhost while the browser uses 127.0.0.1.
  // Host is the actual request authority; never trust forwarded headers here.
  const url = new URL(req.url),
    host = req.headers.get("host");
  let expected = url.origin;
  if (process.env.MEMORY_PUBLIC_ORIGIN)
    expected = new URL(process.env.MEMORY_PUBLIC_ORIGIN).origin;
  else if (host) {
    if (!/^[a-zA-Z0-9.\-\[\]:]+$/.test(host))
      throw new AppError("허용하지 않는 요청 주소입니다.", 403);
    expected = new URL(`${url.protocol}//${host}`).origin;
  }
  if (origin && origin !== expected)
    throw new AppError("다른 사이트에서 보낸 요청은 허용하지 않습니다.", 403);
  if (req.headers.get("sec-fetch-site") === "cross-site")
    throw new AppError("허용하지 않는 요청입니다.", 403);
}
export function ownerSession(req: Request) {
  const token = req.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)memory_owner=([a-f0-9]{64})(?:;|$)/)?.[1];
  return { owner: token ?? randomBytes(32).toString("hex"), fresh: !token };
}
export function validateBaseUrl(raw: string, mode: "local" | "api") {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError("올바른 연결 주소를 입력해 주세요.");
  }
  if (url.username || url.password || url.search || url.hash)
    throw new AppError("인증 정보나 쿼리가 포함된 주소는 사용할 수 없습니다.");
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  const allowed = [
    "api.openai.com",
    ...(process.env.MEMORY_API_HOSTS ?? "").split(",").filter(Boolean),
  ];
  if (
    mode === "local"
      ? !local || url.protocol !== "http:"
      : url.protocol !== "https:" || local || !allowed.includes(url.hostname)
  )
    throw new AppError(
      "로컬은 loopback HTTP, API는 허용된 HTTPS 공급자 주소를 사용해 주세요.",
    );
  return url.toString().replace(/\/$/, "");
}
export function nonempty(value: unknown, max = 10000) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new AppError(`1~${max}자의 내용을 입력해 주세요.`);
  return value.trim();
}
export async function boundedRequest(req: Request, limit = 16 * 1024 * 1024) {
  if (!req.body) return req;
  const reader = req.body.getReader(),
    chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) {
      await reader.cancel();
      throw new AppError("전송 파일이 너무 큽니다.", 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body: bytes,
  });
}
