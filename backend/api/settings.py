from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsPayload(BaseModel):
    displayLanguage: str | None = None
    region: str | None = None
    theme: str | None = None
    safeSearch: str | None = Field(default=None, description="moderate|strict|off")
    # Utility prefs (optional)
    utility_timezones: dict[str, str] | None = None
    utility_unit_mode: str | None = None


def _require_session(request: Request) -> dict[str, Any]:
    session = getattr(request.state, "session", None)
    if not session or not session.get("user_id"):
        raise HTTPException(status_code=401, detail="Not authenticated.")
    return session


@router.get("/me")
async def get_my_settings(request: Request) -> JSONResponse:
    session = _require_session(request)
    user_id = str(session["user_id"])
    postgres = request.app.state.postgres
    row = await postgres.get_user_settings(user_id)
    settings_doc = row["settings"] if row and row.get("settings") else {}
    updated_at: datetime | None = row.get("updated_at") if row else None
    return JSONResponse({"settings": settings_doc, "updated_at": updated_at.isoformat() if updated_at else None})


@router.put("/me")
async def put_my_settings(body: SettingsPayload, request: Request) -> JSONResponse:
    session = _require_session(request)
    user_id = str(session["user_id"])
    postgres = request.app.state.postgres

    # Merge with existing so partial updates work.
    existing = await postgres.get_user_settings(user_id)
    existing_doc = existing["settings"] if existing and existing.get("settings") else {}

    next_doc = {**existing_doc, **{k: v for k, v in body.model_dump().items() if v is not None}}
    saved = await postgres.upsert_user_settings(user_id=user_id, settings_payload=next_doc)
    updated_at: datetime | None = saved.get("updated_at")
    return JSONResponse({"ok": True, "settings": saved.get("settings", next_doc), "updated_at": updated_at.isoformat() if updated_at else None})

