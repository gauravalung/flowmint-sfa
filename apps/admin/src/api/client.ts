// Thin fetch wrapper — same shape as apps/mobile/src/api/client.ts so the
// two apps agree on how errors and auth headers work, adapted for the web
// (Vite env var instead of Expo config; supports PUT/DELETE and file
// upload/download, which the admin screens need and the mobile app didn't).
import type { ApiErrorBody } from "@flowmint/shared";

const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:4000/api/v1";

export class ApiRequestError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; accessToken?: string; isFormData?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (!options.isFormData) headers["Content-Type"] = "application/json";
  if (options.accessToken) headers["Authorization"] = `Bearer ${options.accessToken}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.isFormData ? (options.body as FormData) : options.body ? JSON.stringify(options.body) : undefined,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const errBody = data as ApiErrorBody | null;
    throw new ApiRequestError(
      res.status,
      errBody?.error?.code ?? "UNKNOWN_ERROR",
      errBody?.error?.message ?? "Something went wrong. Please try again."
    );
  }

  return data as T;
}

// For CSV template downloads — the response isn't JSON, so it bypasses the
// json-parsing path above entirely.
async function requestBlob(path: string, accessToken?: string): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) throw new ApiRequestError(res.status, "DOWNLOAD_FAILED", "Could not download the file.");
  return res.blob();
}

export const api = {
  get: <T>(path: string, accessToken?: string) => request<T>(path, { method: "GET", accessToken }),
  post: <T>(path: string, body?: unknown, accessToken?: string) =>
    request<T>(path, { method: "POST", body, accessToken }),
  patch: <T>(path: string, body?: unknown, accessToken?: string) =>
    request<T>(path, { method: "PATCH", body, accessToken }),
  put: <T>(path: string, body?: unknown, accessToken?: string) =>
    request<T>(path, { method: "PUT", body, accessToken }),
  delete: <T>(path: string, accessToken?: string) => request<T>(path, { method: "DELETE", accessToken }),
  upload: <T>(path: string, formData: FormData, accessToken?: string) =>
    request<T>(path, { method: "POST", body: formData, accessToken, isFormData: true }),
  blob: requestBlob,
};
