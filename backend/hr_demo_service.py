"""Standalone, real HTTP HR demo service used by enterprise acceptance tests."""

from __future__ import annotations

import os
import sqlite3
import time
import uuid
from datetime import date
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Query
from pydantic import BaseModel


DB_PATH = Path(os.environ.get("AGENTFOUNDRY_HR_DEMO_DB", "/tmp/agentfoundry-hr-demo.db"))
app = FastAPI(title="AgentFoundry HR Demo Service")


def _db() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("CREATE TABLE IF NOT EXISTS balances (employee_id TEXT PRIMARY KEY, annual REAL NOT NULL, sick REAL NOT NULL)")
    connection.execute("CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, idempotency_key TEXT UNIQUE NOT NULL, employee_id TEXT NOT NULL, leave_type TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL)")
    connection.execute("INSERT OR IGNORE INTO balances VALUES ('acme_alice', 10, 5)")
    connection.execute("INSERT OR IGNORE INTO balances VALUES ('acme_bob', 15, 5)")
    connection.commit()
    return connection


class LeaveCreate(BaseModel):
    employee_id: str
    leave_type: str
    start_date: date
    end_date: date
    reason: str


def _fault(employee_id: str) -> None:
    mode = os.environ.get("AGENTFOUNDRY_HR_FAULT", "").strip().lower()
    if employee_id == "force_hr_500" or mode == "500":
        raise HTTPException(500, "HR demo forced failure")
    if employee_id == "force_hr_timeout" or mode == "timeout":
        time.sleep(float(os.environ.get("AGENTFOUNDRY_HR_FAULT_DELAY", "2")))


@app.get("/employees/{employee_id}/leave-balance")
def balance(employee_id: str) -> dict[str, object]:
    _fault(employee_id)
    with _db() as connection:
        row = connection.execute("SELECT * FROM balances WHERE employee_id=?", (employee_id,)).fetchone()
    if row is None:
        return {"employee_id": employee_id, "annual": 0, "sick": 0}
    return dict(row)


@app.get("/employees/{employee_id}/leave-conflicts")
def conflicts(employee_id: str, start_date: date = Query(...), end_date: date = Query(...)) -> dict[str, object]:
    _fault(employee_id)
    with _db() as connection:
        rows = connection.execute("SELECT id, start_date, end_date FROM requests WHERE employee_id=? AND status='submitted' AND NOT(end_date < ? OR start_date > ?)", (employee_id, start_date.isoformat(), end_date.isoformat())).fetchall()
    return {"conflict": bool(rows), "items": [dict(row) for row in rows]}


@app.post("/leave-requests", status_code=201)
def create_leave(payload: LeaveCreate, idempotency_key: str = Header(..., alias="Idempotency-Key")) -> dict[str, object]:
    _fault(payload.employee_id)
    if payload.end_date < payload.start_date:
        raise HTTPException(422, "end_date must not precede start_date")
    with _db() as connection:
        existing = connection.execute("SELECT * FROM requests WHERE idempotency_key=?", (idempotency_key,)).fetchone()
        if existing:
            return dict(existing)
        request_id = f"HR-{uuid.uuid4().hex[:12].upper()}"
        connection.execute("INSERT INTO requests VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted')", (request_id, idempotency_key, payload.employee_id, payload.leave_type, payload.start_date.isoformat(), payload.end_date.isoformat(), payload.reason))
        connection.commit()
        return dict(connection.execute("SELECT * FROM requests WHERE id=?", (request_id,)).fetchone())


@app.get("/leave-requests/{request_id}")
def get_leave(request_id: str) -> dict[str, object]:
    with _db() as connection:
        row = connection.execute("SELECT * FROM requests WHERE id=?", (request_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "leave request was not found")
    return dict(row)


@app.post("/leave-requests/{request_id}/cancel")
def cancel_leave(request_id: str, idempotency_key: str = Header(..., alias="Idempotency-Key")) -> dict[str, object]:
    del idempotency_key
    with _db() as connection:
        row = connection.execute("SELECT * FROM requests WHERE id=?", (request_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "leave request was not found")
        connection.execute("UPDATE requests SET status='cancelled' WHERE id=?", (request_id,))
        connection.commit()
        return dict(connection.execute("SELECT * FROM requests WHERE id=?", (request_id,)).fetchone())
