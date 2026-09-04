from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from .models import JobAction, JobActionReceipt, JobCapabilities, JobEventPage, JobSnapshot, JobSubmission, JobSubmissionReceipt


class JobProtocolError(RuntimeError):
    def __init__(self, status: int, code: str, message: str, retryable: bool = False, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.retryable = retryable
        self.details = details


class JobProtocolClient:
    def __init__(self, base_url: str, *, headers: dict[str, str] | None = None, timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self.headers = dict(headers or {})
        self.timeout = timeout

    def _request(self, path: str, model: type[Any], *, method: str = "GET", body: Any = None, headers: dict[str, str] | None = None):
        request_headers = {"Accept": "application/json", **self.headers, **(headers or {})}
        payload = None
        if body is not None:
            request_headers["Content-Type"] = "application/json"
            payload = json.dumps(body, separators=(",", ":")).encode()
        request = Request(f"{self.base_url}{path}", data=payload, headers=request_headers, method=method)
        try:
            with urlopen(request, timeout=self.timeout) as response:
                return model.model_validate_json(response.read())
        except HTTPError as exc:
            raw = exc.read()
            try:
                error = json.loads(raw).get("error", {})
            except Exception:
                error = {}
            raise JobProtocolError(exc.code, error.get("code", "job_protocol_error"), error.get("message", str(exc)), bool(error.get("retryable")), error.get("details")) from exc

    def submit(self, submission: JobSubmission, idempotency_key: str) -> JobSubmissionReceipt:
        return self._request("/v1/jobs", JobSubmissionReceipt, method="POST", body=submission.model_dump(mode="json"), headers={"Idempotency-Key": idempotency_key})

    def get(self, job_id: str) -> JobSnapshot:
        return self._request(f"/v1/jobs/{quote(job_id, safe='')}", JobSnapshot)

    def poll(self, job_id: str, *, after: str | None = None, limit: int = 100) -> JobEventPage:
        query = urlencode({k: v for k, v in {"after": after, "limit": limit}.items() if v is not None})
        return self._request(f"/v1/jobs/{quote(job_id, safe='')}/events/poll?{query}", JobEventPage)

    def cancel(self, job_id: str) -> JobSnapshot:
        return self._request(f"/v1/jobs/{quote(job_id, safe='')}/cancel", JobSnapshot, method="POST")

    def action(self, job_id: str, action: JobAction, idempotency_key: str) -> JobActionReceipt:
        return self._request(f"/v1/jobs/{quote(job_id, safe='')}/actions", JobActionReceipt, method="POST", body=action.model_dump(mode="json"), headers={"Idempotency-Key": idempotency_key})

    def capabilities(self) -> JobCapabilities:
        return self._request("/v1/jobs/capabilities", JobCapabilities)

    def events_url(self, job_id: str, *, after: str | None = None) -> str:
        suffix = f"?{urlencode({'after': after})}" if after else ""
        return f"{self.base_url}/v1/jobs/{quote(job_id, safe='')}/events{suffix}"
