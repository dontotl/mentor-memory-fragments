export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(!(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ error: `요청 실패 (${response.status})` }));
    throw new Error(body.error || "요청을 완료하지 못했어요.");
  }
  return response.json();
}
export const post = <T>(url: string, data: unknown) =>
  api<T>(url, { method: "POST", body: JSON.stringify(data) });
export function errorText(e: unknown) {
  return e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요.";
}
