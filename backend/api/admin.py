from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

router = APIRouter()


def _require_admin(request: Request) -> dict:
    session = getattr(request.state, "session", None)
    if not session or not session.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return session


@router.get("/admin/users")
async def list_users(request: Request, limit: int = 50, offset: int = 0) -> dict:
    _require_admin(request)
    postgres = request.app.state.postgres
    users = await postgres.list_users(limit=limit, offset=offset)
    total = await postgres.count_users()
    return {"users": users, "total": total, "limit": limit, "offset": offset}


@router.get("/admin/users/{user_id}/searches")
async def user_search_history(request: Request, user_id: str, limit: int = 50) -> dict:
    _require_admin(request)
    postgres = request.app.state.postgres
    history = await postgres.get_user_search_history(user_id, limit=limit)
    return {"user_id": user_id, "searches": history}


@router.get("/admin/users/{user_id}/clicks")
async def user_click_history(request: Request, user_id: str, limit: int = 50) -> dict:
    _require_admin(request)
    postgres = request.app.state.postgres
    clicks = await postgres.get_user_click_history(user_id, limit=limit)
    return {"user_id": user_id, "clicks": clicks}


@router.get("/admin/activity")
async def admin_user_activity(request: Request, limit: int = 50, offset: int = 0) -> dict:
    _require_admin(request)
    postgres = request.app.state.postgres
    rows = await postgres.list_admin_user_activity(limit=limit, offset=offset)
    total = await postgres.count_admin_user_activity()
    return {"rows": rows, "total": total, "limit": limit, "offset": offset}


@router.get("/admin/report")
async def admin_user_activity_report(request: Request, sample_limit: int = 20) -> dict:
    _require_admin(request)
    postgres = request.app.state.postgres
    report = await postgres.get_admin_user_activity_report(sample_limit=sample_limit)
    return report
