import { parseApiError } from "./errors";

export { parseApiError };

/** Relative in browser; full URL when web runs inside Expo WebView on another host. */
const API =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "/api";

function getToken() {
  return localStorage.getItem("token");
}

async function readBody(res: Response): Promise<{ text: string; json: unknown | null }> {
  const text = await res.text();
  if (!text.trim()) return { text: "", json: null };
  try {
    return { text, json: JSON.parse(text) };
  } catch {
    return { text, json: null };
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { ...options, headers });
  } catch {
    throw new Error("Cannot reach server. Is the backend running on port 3001?");
  }

  const { text, json } = await readBody(res);

  if (!res.ok) {
    throw new Error(parseApiError(json ?? {}, res.statusText || "Request failed"));
  }

  if (res.status === 204 || !text.trim()) {
    return null as T;
  }

  return json as T;
}

export function downloadUrl(path: string) {
  const token = getToken();
  return `${API}${path}${path.includes("?") ? "&" : "?"}token=${token}`;
}

export async function downloadFile(path: string, filename: string) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(parseApiError(err, "Download failed"));
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
