"""HTTP-only connector for the replaceable HR leave service."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any


class HRServiceError(RuntimeError):
    def __init__(self, code: str, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code


@dataclass(frozen=True)
class HRClient:
    base_url: str
    timeout_seconds: float = 5.0

    def _request(
        self,
        method: str,
        path: str,
        *,
        payload: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        headers = {"Accept": "application/json"}
        data = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        request = urllib.request.Request(
            f"{self.base_url.rstrip('/')}{path}", data=data, headers=headers, method=method
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            try:
                detail = json.loads(exc.read().decode("utf-8")).get("detail")
            except Exception:
                detail = None
            raise HRServiceError("HR_HTTP_ERROR", str(detail or "HR 服务请求失败"), exc.code) from exc
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise HRServiceError("HR_UNAVAILABLE", "HR 服务暂时不可用，请稍后重试") from exc

    def get_balance(self, employee_id: str) -> dict[str, Any]:
        value = urllib.parse.quote(employee_id, safe="")
        return self._request("GET", f"/employees/{value}/leave-balance")

    def check_conflict(self, employee_id: str, start_date: str, end_date: str) -> dict[str, Any]:
        query = urllib.parse.urlencode({"start_date": start_date, "end_date": end_date})
        value = urllib.parse.quote(employee_id, safe="")
        return self._request("GET", f"/employees/{value}/leave-conflicts?{query}")

    def create_leave(self, payload: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        return self._request("POST", "/leave-requests", payload=payload, idempotency_key=idempotency_key)

    def get_leave(self, request_id: str) -> dict[str, Any]:
        return self._request("GET", f"/leave-requests/{urllib.parse.quote(request_id, safe='')}")

    def cancel_leave(self, request_id: str, idempotency_key: str) -> dict[str, Any]:
        return self._request("POST", f"/leave-requests/{urllib.parse.quote(request_id, safe='')}/cancel", payload={}, idempotency_key=idempotency_key)
