import { cookies } from "next/headers";

const internalApi = process.env.INTERNAL_API_URL ?? "http://localhost:8000";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const timeoutSignal = typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(8_000) : undefined;
  const response = await fetch(`${internalApi}/api/v1${path}`, {
    ...init,
    headers: { cookie: cookieStore.toString(), ...init?.headers },
    signal: init?.signal ?? timeoutSignal,
    cache: "no-store",
  });
  if (!response.ok) {
    const error = new Error(`API ${response.status}`) as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}

export async function safeApi<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}

