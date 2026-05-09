/**
 * LexAI backend API client. Base URL from NEXT_PUBLIC_API_URL.
 */

const getBaseUrl = (): string => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url || url.trim() === "") {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Add it to .env.local (e.g. http://localhost:8000)."
    );
  }
  return url.replace(/\/$/, "");
};

export type UploadStatus = "processing" | "ready" | "error";

export interface UploadResponse {
  doc_id: string;
  status: UploadStatus;
}

export interface DocStatusResponse {
  doc_id: string;
  status: UploadStatus;
  parties?: string[];
  doc_type?: string;
}

export type RiskLevel = "high" | "medium" | "low";

export interface ClauseAnalysis {
  clause_num: number;
  raw_text: string;
  plain_english: string;
  risk_per_party: Record<string, RiskLevel | string>;
  favors: string;
  law_cited: string;
  recommendation: string;
  overall_risk: RiskLevel | string;
}

export interface ChatHistoryEntry {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
}

export interface ChatRequestBody {
  question: string;
  history: ChatHistoryEntry[];
}

async function handleResponse<T>(res: Response, context: string): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: string; message?: string };
      detail = body.detail ?? body.message ?? detail;
    } catch {
      try {
        detail = await res.text();
      } catch {
        /* ignore */
      }
    }
    throw new Error(`${context}: ${res.status} ${detail}`);
  }
  return res.json() as Promise<T>;
}

export async function uploadPdf(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}/upload`, {
      method: "POST",
      body: formData,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    throw new Error(`Upload failed: ${msg}`);
  }
  return handleResponse<UploadResponse>(res, "Upload");
}

export async function getDocStatus(docId: string): Promise<DocStatusResponse> {
  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}/doc/${encodeURIComponent(docId)}/status`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    throw new Error(`Status request failed: ${msg}`);
  }
  return handleResponse<DocStatusResponse>(res, "Status");
}

export async function getDocAnalysis(
  docId: string
): Promise<ClauseAnalysis[]> {
  let res: Response;
  try {
    res = await fetch(
      `${getBaseUrl()}/doc/${encodeURIComponent(docId)}/analysis`
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    throw new Error(`Analysis request failed: ${msg}`);
  }
  const data = await handleResponse<unknown>(res, "Analysis");
  if (!Array.isArray(data)) {
    throw new Error("Analysis response is not an array");
  }
  return data as ClauseAnalysis[];
}

/**
 * POST chat and return the raw Response for SSE consumption (caller reads body stream).
 */
export async function postDocChatStream(
  docId: string,
  body: ChatRequestBody
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(
      `${getBaseUrl()}/doc/${encodeURIComponent(docId)}/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(body),
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    throw new Error(`Chat request failed: ${msg}`);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = (await res.json()) as { detail?: string };
      detail = j.detail ?? detail;
    } catch {
      /* use statusText */
    }
    throw new Error(`Chat: ${res.status} ${detail}`);
  }
  return res;
}

export type StreamChunk =
  | { type: "token"; text: string }
  | { type: "citations"; citations: string[] }
  | { type: "done" };

function parseSseDataLine(payload: string): StreamChunk[] {
  const trimmed = payload.trim();
  if (!trimmed) return [];

  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof obj.token === "string") {
      return [{ type: "token", text: obj.token }];
    }
    if (typeof obj.text === "string") {
      return [{ type: "token", text: obj.text }];
    }
    if (typeof obj.content === "string") {
      return [{ type: "token", text: obj.content }];
    }
    if (typeof obj.delta === "string") {
      return [{ type: "token", text: obj.delta }];
    }
    if (Array.isArray(obj.citations)) {
      const citations = obj.citations.filter(
        (c): c is string => typeof c === "string"
      );
      return [{ type: "citations", citations }];
    }
    if (obj.done === true) {
      return [{ type: "done" }];
    }
    if (obj.message && typeof obj.message === "string") {
      return [{ type: "token", text: obj.message }];
    }
  } catch {
    /* not JSON — treat as plain token */
  }
  return [{ type: "token", text: trimmed }];
}

/**
 * Reads an SSE stream and yields parsed chunks. Handles `data: ...` lines and optional `[DONE]`.
 */
export async function* readChatSseStream(
  body: ReadableStream<Uint8Array> | null
): AsyncGenerator<StreamChunk, void, unknown> {
  if (!body) return;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data:")) {
          const payload = line.slice(5).trim();
          if (payload === "[DONE]" || payload === "") continue;
          for (const chunk of parseSseDataLine(payload)) {
            yield chunk;
          }
        } else if (line.trim() !== "" && !line.startsWith(":")) {
          // Some servers send raw lines
          for (const chunk of parseSseDataLine(line)) {
            yield chunk;
          }
        }
      }
    }

    if (buffer.trim()) {
      for (const chunk of parseSseDataLine(buffer)) {
        yield chunk;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
