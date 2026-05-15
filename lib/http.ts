const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
};

function buildUrl(path: string, query?: RequestOptions["query"]) {
  if (!BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }
  const url = new URL(
    path.startsWith("/") ? path : `/${path}`,
    BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`,
  );
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function apiFetch<T>(
  path: string,
  { query, body, headers, ...init }: RequestOptions = {},
): Promise<T> {
  const url = buildUrl(path, query);
  const hasBody = body !== undefined;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const parsed = text ? safeJson(text) : null;

  if (!res.ok) {
    throw new ApiError(
      res.status,
      `${init.method ?? "GET"} ${path} → ${res.status}`,
      parsed ?? text,
    );
  }
  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
