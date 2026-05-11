from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Iterable

import httpx
import uvicorn
from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

<<<<<<< HEAD
from backend.api.analytics import router as analytics_router
from backend.api.admin import router as admin_router
=======
>>>>>>> 082393a (Remove nested repo and clean structure)
from backend.api.auth import router as auth_router
from backend.api.health import router as health_router
from backend.api.search import router as search_router
from backend.api.suggest import router as suggest_router
from backend.api.trending import router as trending_router
from backend.api.attachments import router as attachments_router
from backend.api.config_api import router as config_router
<<<<<<< HEAD
from backend.config import settings, validate_security_settings
=======
from backend.config import settings
>>>>>>> 082393a (Remove nested repo and clean structure)
from backend.crawler.scheduler import CrawlScheduler
from backend.runtime import build_frontier, open_runtime_services, require_redis, require_search_index
from backend.search.engine import SearchEngine


validate_security_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with open_runtime_services(
        with_redis=True,
        with_search_index=True,
        ensure_index=True,
    ) as services:
        redis = require_redis(services)
        search_index = require_search_index(services)
        frontier = build_frontier(services)

        app.state.postgres = services.postgres
        app.state.redis = redis
        app.state.search_index = search_index
        app.state.search_engine = SearchEngine(
            postgres=services.postgres,
            redis=redis,
            search_index=search_index,
        )
        app.state.frontier = frontier
        app.state.scheduler = None
<<<<<<< HEAD
        if settings.enable_crawl_scheduler and services.postgres.is_available:
=======
        if settings.enable_crawl_scheduler:
>>>>>>> 082393a (Remove nested repo and clean structure)
            app.state.scheduler = CrawlScheduler(frontier, services.postgres, search_index)
            app.state.scheduler.start()

        try:
            yield
        finally:
            if app.state.scheduler is not None:
                app.state.scheduler.stop()


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
<<<<<<< HEAD
    allow_origins=settings.cors_allow_origins,
=======
    allow_origins=["*"],
>>>>>>> 082393a (Remove nested repo and clean structure)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def session_middleware(request: Request, call_next):
    token = request.cookies.get("qsession")
    if token:
        try:
            session = await request.app.state.postgres.get_session(token)
            request.state.session = session
        except Exception:
            request.state.session = None
    else:
        request.state.session = None
    return await call_next(request)

app.include_router(search_router, prefix="/api")
app.include_router(suggest_router, prefix="/api")
app.include_router(trending_router, prefix="/api")
app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
<<<<<<< HEAD
app.include_router(analytics_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
=======
>>>>>>> 082393a (Remove nested repo and clean structure)
app.include_router(attachments_router, prefix="/api")
app.include_router(config_router, prefix="/api")


def _iter_tracked_files() -> Iterable[Path]:
    tracked_roots = (
        Path("backend"),
        Path(settings.frontend_dir),
    )

    for root in tracked_roots:
        if not root.exists():
            continue
        for file_path in root.rglob("*"):
            if file_path.is_file():
                yield file_path


@app.get("/api/dev/version")
async def get_dev_version() -> JSONResponse:
    latest_mtime_ns = 0

    for file_path in _iter_tracked_files():
        latest_mtime_ns = max(latest_mtime_ns, file_path.stat().st_mtime_ns)

    return JSONResponse({"version": str(latest_mtime_ns)})


@app.get("/api/location/reverse")
async def reverse_location(lat: float = Query(...), lng: float = Query(...)) -> JSONResponse:
    url = "https://nominatim.openstreetmap.org/reverse"
    params = {
        "format": "jsonv2",
        "lat": lat,
        "lon": lng,
        "addressdetails": 1,
    }

    try:
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            response = await client.get(
                url,
                params=params,
                headers={"User-Agent": settings.crawl_user_agent},
            )
            response.raise_for_status()
    except httpx.HTTPError:
        return JSONResponse({"lat": lat, "lng": lng, "results": []})

    payload = response.json()
    address = payload.get("address", {})
    result = {
        "formattedAddress": payload.get("display_name", ""),
        "areaName": address.get("suburb", ""),
        "cityName": address.get("city", "") or address.get("town", ""),
        "stateName": address.get("state", ""),
        "countryName": address.get("country", ""),
        "pincode": address.get("postcode", ""),
        "latitude": float(payload.get("lat", lat)),
        "longitude": float(payload.get("lon", lng)),
        "placeId": str(payload.get("place_id", "")),
        "types": [payload["type"]] if payload.get("type") else [],
    }
    return JSONResponse({"lat": lat, "lng": lng, "results": [result]})


frontend_dir = Path(settings.frontend_dir)


@app.get("/about", include_in_schema=False)
async def about_page() -> FileResponse:
    return FileResponse(frontend_dir / "about.html")


@app.get("/privacy", include_in_schema=False)
async def privacy_page() -> FileResponse:
    return FileResponse(frontend_dir / "privacy.html")


@app.get("/terms", include_in_schema=False)
async def terms_page() -> FileResponse:
    return FileResponse(frontend_dir / "terms.html")


@app.get("/help", include_in_schema=False)
async def help_page() -> FileResponse:
    return FileResponse(frontend_dir / "help.html")


@app.get("/feedback", include_in_schema=False)
async def feedback_page() -> FileResponse:
    return FileResponse(frontend_dir / "feedback.html")

app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")


if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        reload_dirs=["backend", settings.frontend_dir],
    )
