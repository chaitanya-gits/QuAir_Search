from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter()


class SearchTrackPayload(BaseModel):
    anonymous_id: str = ""
    query_raw: str
    query_normalized: str
    result_count: int = 0
    response_ms: int | None = None
    region: str = ""
    display_language: str = "en-US"
    safe_search: str = "moderate"
    has_attachment: bool = False
    search_tab: str = "all"


class ClickTrackPayload(BaseModel):
    anonymous_id: str = ""
    search_event_id: str | None = None
    result_url: str
    result_title: str = ""
    result_domain: str = ""
    result_rank: int | None = None
    query_raw: str = ""


class ImpressionTrackPayload(BaseModel):
    anonymous_id: str = ""
    search_event_id: str | None = None
    event_type: str
    payload: dict = {}


@router.post("/track/search")
async def track_search(body: SearchTrackPayload, request: Request) -> dict:
    postgres = request.app.state.postgres
    session = getattr(request.state, "session", None)
    event_id = await postgres.record_search_event(
        user_id=str(session["user_id"]) if session else None,
        session_id=str(session["id"]) if session else None,
        anonymous_id=body.anonymous_id,
        query_raw=body.query_raw,
        query_normalized=body.query_normalized,
        result_count=body.result_count,
        response_ms=body.response_ms,
        ip_address=request.client.host if request.client else "",
        user_agent=request.headers.get("user-agent", ""),
        region=body.region,
        display_language=body.display_language,
        safe_search=body.safe_search,
        has_attachment=body.has_attachment,
        search_tab=body.search_tab,
    )
    return {"event_id": event_id}


@router.post("/track/click")
async def track_click(body: ClickTrackPayload, request: Request) -> dict:
    postgres = request.app.state.postgres
    session = getattr(request.state, "session", None)
    await postgres.record_click_event(
        user_id=str(session["user_id"]) if session else None,
        session_id=str(session["id"]) if session else None,
        anonymous_id=body.anonymous_id,
        search_event_id=body.search_event_id,
        result_url=body.result_url,
        result_title=body.result_title,
        result_domain=body.result_domain,
        result_rank=body.result_rank,
        query_raw=body.query_raw,
        ip_address=request.client.host if request.client else "",
        user_agent=request.headers.get("user-agent", ""),
        referrer_url=request.headers.get("referer", ""),
    )
    return {"ok": True}


@router.post("/track/impression")
async def track_impression(body: ImpressionTrackPayload, request: Request) -> dict:
    postgres = request.app.state.postgres
    session = getattr(request.state, "session", None)
    await postgres.record_impression_event(
        user_id=str(session["user_id"]) if session else None,
        session_id=str(session["id"]) if session else None,
        anonymous_id=body.anonymous_id,
        search_event_id=body.search_event_id,
        event_type=body.event_type,
        payload=body.payload,
    )
    return {"ok": True}
