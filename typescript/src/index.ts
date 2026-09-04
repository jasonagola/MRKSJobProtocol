export type { components, paths } from "./generated.js";

import type { components } from "./generated.js";

export type JobSubmission = components["schemas"]["JobSubmission"];
export type JobSnapshot = components["schemas"]["JobSnapshot"];
export type JobSubmissionReceipt = components["schemas"]["JobSubmissionReceipt"];
export type JobEvent = components["schemas"]["JobEvent"];
export type JobEventPage = components["schemas"]["JobEventPage"];
export type JobAction = components["schemas"]["JobAction"];
export type JobActionReceipt = components["schemas"]["JobActionReceipt"];
export type JobCapabilities = components["schemas"]["JobCapabilities"];

export class JobProtocolError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false,
    readonly details: Record<string, unknown> | null = null,
  ) {
    super(message);
  }
}

export type JobProtocolClientOptions = {
  baseUrl: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
};

export class JobProtocolClient {
  readonly baseUrl: string;
  readonly headers: Record<string, string>;
  readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: JobProtocolClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.headers = {...options.headers};
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {accept: "application/json", ...this.headers, ...init.headers},
    });
    const body = await response.json() as T | {error?: {code?: string; message?: string; retryable?: boolean; details?: Record<string, unknown>}};
    if (!response.ok) {
      const error = "error" in (body as object) ? (body as {error?: {code?: string; message?: string; retryable?: boolean; details?: Record<string, unknown>}}).error : undefined;
      throw new JobProtocolError(response.status, error?.code ?? "job_protocol_error", error?.message ?? response.statusText, error?.retryable ?? false, error?.details ?? null);
    }
    return body as T;
  }

  submit(input: JobSubmission, idempotencyKey: string): Promise<JobSubmissionReceipt> {
    return this.request("/v1/jobs", {method: "POST", headers: {"content-type": "application/json", "idempotency-key": idempotencyKey}, body: JSON.stringify(input)});
  }

  get(jobId: string): Promise<JobSnapshot> {
    return this.request(`/v1/jobs/${encodeURIComponent(jobId)}`);
  }

  poll(jobId: string, after?: string | null, limit = 100): Promise<JobEventPage> {
    const query = new URLSearchParams({limit: String(limit)});
    if (after) query.set("after", after);
    return this.request(`/v1/jobs/${encodeURIComponent(jobId)}/events/poll?${query}`);
  }

  cancel(jobId: string): Promise<JobSnapshot> {
    return this.request(`/v1/jobs/${encodeURIComponent(jobId)}/cancel`, {method: "POST"});
  }

  action(jobId: string, action: JobAction, idempotencyKey: string): Promise<JobActionReceipt> {
    return this.request(`/v1/jobs/${encodeURIComponent(jobId)}/actions`, {method: "POST", headers: {"content-type": "application/json", "idempotency-key": idempotencyKey}, body: JSON.stringify(action)});
  }

  capabilities(): Promise<JobCapabilities> {
    return this.request("/v1/jobs/capabilities");
  }

  eventsUrl(jobId: string, after?: string | null): string {
    const url = new URL(`${this.baseUrl}/v1/jobs/${encodeURIComponent(jobId)}/events`);
    if (after) url.searchParams.set("after", after);
    return url.toString();
  }
}
