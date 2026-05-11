from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import time
import urllib.parse
from base64 import urlsafe_b64decode, urlsafe_b64encode

import httpx
<<<<<<< HEAD
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, EmailStr
=======
from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
>>>>>>> 082393a (Remove nested repo and clean structure)

from backend.config import settings

router = APIRouter(prefix="/auth")

_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

_TOKEN_MAX_AGE = 60 * 60 * 24 * 7
_STATE_MAX_AGE = 600

_GOOGLE_STATE_COOKIE = "google_oauth_state"
_GOOGLE_EXPECTED_EMAIL_COOKIE = "google_oauth_expected_email"
<<<<<<< HEAD
_GOOGLE_FLOW_COOKIE = "google_oauth_flow"

# Per-account session cookie prefix.  Cookie name = _ACCT_PREFIX + md5(email).
_ACCT_PREFIX = "qsession_"
_DB_ACCT_PREFIX = "qdbsession_"
=======

# Per-account session cookie prefix.  Cookie name = _ACCT_PREFIX + md5(email).
_ACCT_PREFIX = "qsession_"
>>>>>>> 082393a (Remove nested repo and clean structure)


def _b64url(data: bytes) -> str:
    return urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(value: str) -> bytes:
    value += "=" * (-len(value) % 4)
    return urlsafe_b64decode(value)


def _create_jwt(payload: dict) -> str:
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = _b64url(json.dumps(payload).encode())
    signature = hmac.new(
        settings.jwt_secret.encode(),
        f"{header}.{body}".encode(),
        hashlib.sha256,
    ).digest()
    return f"{header}.{body}.{_b64url(signature)}"


def _verify_jwt(token: str) -> dict | None:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        expected_sig = hmac.new(
            settings.jwt_secret.encode(),
            f"{parts[0]}.{parts[1]}".encode(),
            hashlib.sha256,
        ).digest()
        actual_sig = _b64url_decode(parts[2])
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        payload = json.loads(_b64url_decode(parts[1]))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


def _email_cookie_name(email: str) -> str:
    """Return a per-account cookie name derived from the email address."""
    digest = hashlib.md5(email.strip().lower().encode()).hexdigest()[:12]
    return f"{_ACCT_PREFIX}{digest}"


<<<<<<< HEAD
def _database_email_cookie_name(email: str) -> str:
    """Return a per-account database session cookie name derived from email."""
    digest = hashlib.md5(email.strip().lower().encode()).hexdigest()[:12]
    return f"{_DB_ACCT_PREFIX}{digest}"


=======
>>>>>>> 082393a (Remove nested repo and clean structure)
def _issue_session_cookie(response: Response, user: dict) -> None:
    token = _create_jwt({**user, "exp": int(time.time()) + _TOKEN_MAX_AGE})
    # Set the active session cookie.
    response.set_cookie(
        "session",
        token,
        httponly=True,
<<<<<<< HEAD
        samesite=settings.cookie_samesite,
        max_age=_TOKEN_MAX_AGE,
        secure=settings.cookie_secure,
=======
        samesite="lax",
        max_age=_TOKEN_MAX_AGE,
        secure=False,
>>>>>>> 082393a (Remove nested repo and clean structure)
    )
    # Also store a per-account cookie so we can switch back to this account
    # without going through Google OAuth again.
    email = user.get("email", "")
    if email:
        response.set_cookie(
            _email_cookie_name(email),
            token,
            httponly=True,
<<<<<<< HEAD
            samesite=settings.cookie_samesite,
            max_age=_TOKEN_MAX_AGE,
            secure=settings.cookie_secure,
        )


def _issue_database_session_cookie(response: Response, session_token: str, email: str = "") -> None:
    response.set_cookie(
        "qsession",
        session_token,
        httponly=True,
        samesite=settings.cookie_samesite,
        max_age=2592000,
        secure=settings.cookie_secure,
    )
    if email:
        response.set_cookie(
            _database_email_cookie_name(email),
            session_token,
            httponly=True,
            samesite=settings.cookie_samesite,
            max_age=2592000,
            secure=settings.cookie_secure,
=======
            samesite="lax",
            max_age=_TOKEN_MAX_AGE,
            secure=False,
>>>>>>> 082393a (Remove nested repo and clean structure)
        )


def _build_redirect(path: str) -> str:
    base = settings.oauth_redirect_base.rstrip("/")
    return f"{base}{path}"


def _clear_google_oauth_cookies(response: Response) -> None:
    response.delete_cookie(_GOOGLE_STATE_COOKIE)
    response.delete_cookie(_GOOGLE_EXPECTED_EMAIL_COOKIE)
<<<<<<< HEAD
    response.delete_cookie(_GOOGLE_FLOW_COOKIE)


def _build_popup_response(status: str, user: dict | None = None, error: str = "", session_token: str = "", jwt_token: str = "") -> HTMLResponse:
    payload = {
        "source": "quair-google-oauth",
        "status": status,
        "user": user or None,
        "error": error or "",
        "session_token": session_token,
        "jwt_token": jwt_token,
    }
    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>QuAir Authentication</title>
</head>
<body>
  <script>
    (function() {{
      const payload = {json.dumps(payload)};
      try {{
        if (window.opener && !window.opener.closed) {{
          window.opener.postMessage(payload, window.location.origin);
        }}
      }} finally {{
        window.close();
      }}
    }})();
  </script>
</body>
</html>"""
    return HTMLResponse(html)


class EmailLoginPayload(BaseModel):
    email: EmailStr
    password: str


@router.post("/email/login")
async def email_login(body: EmailLoginPayload, request: Request, response: Response) -> dict:
    raise HTTPException(status_code=503, detail="Email login is disabled until secure password verification is implemented.")


@router.post("/set-session")
async def set_session(request: Request, response: Response) -> dict:
    """Set session cookies from popup auth flow."""
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"ok": False, "error": "invalid_body"}, status_code=400)

    session_token = str(body.get("session_token", "")).strip()
    jwt_token = str(body.get("jwt_token", "")).strip()

    if not session_token or not jwt_token:
        return JSONResponse({"ok": False, "error": "missing_tokens"}, status_code=400)

    # Verify the JWT to get user
    user = _verify_jwt(jwt_token)
    if not user:
        return JSONResponse({"ok": False, "error": "invalid_jwt"}, status_code=401)

    email = user.get("email", "")
    if email:
        # Set the per-account cookies
        response.set_cookie(
            _email_cookie_name(email),
            jwt_token,
            httponly=True,
            samesite=settings.cookie_samesite,
            max_age=_TOKEN_MAX_AGE,
            secure=settings.cookie_secure,
        )
        response.set_cookie(
            _database_email_cookie_name(email),
            session_token,
            httponly=True,
            samesite=settings.cookie_samesite,
            max_age=2592000,
            secure=settings.cookie_secure,
        )

    # Set the active session cookies
    response.set_cookie(
        "session",
        jwt_token,
        httponly=True,
        samesite=settings.cookie_samesite,
        max_age=_TOKEN_MAX_AGE,
        secure=settings.cookie_secure,
    )
    response.set_cookie(
        "qsession",
        session_token,
        httponly=True,
        samesite=settings.cookie_samesite,
        max_age=2592000,
        secure=settings.cookie_secure,
    )

    return {"ok": True}
=======


# ── Account switch (local, no Google redirect) ────────────────────────────────
>>>>>>> 082393a (Remove nested repo and clean structure)
@router.post("/switch")
async def local_switch(request: Request):
    """Switch to a previously-authenticated account using stored session cookies.

    No Google redirect needed — we just swap the active session cookie.
    """
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"ok": False, "error": "invalid_body"}, status_code=400)

    target_email = str(body.get("email", "")).strip().lower()
    if not target_email:
        return JSONResponse({"ok": False, "error": "missing_email"}, status_code=400)

<<<<<<< HEAD
    # Look up the per-account browser session first. This is the fastest path
    # and does not need a Google account chooser.
    cookie_name = _email_cookie_name(target_email)
    stored_token = request.cookies.get(cookie_name, "")
    postgres = request.app.state.postgres
    db_user = await postgres.get_user_by_email(target_email)
    user = _verify_jwt(stored_token) if stored_token else None
    db_cookie_name = _database_email_cookie_name(target_email)
    db_stored_token = request.cookies.get(db_cookie_name, "")
    session_token = db_stored_token
    stored_session = await postgres.get_session(session_token) if session_token else None
    if not stored_session or stored_session["email"].lower() != target_email:
        session_token = ""

    if not user and stored_session:
        user = {
            "id": str(stored_session["user_id"]),
            "provider": stored_session["provider"],
            "name": stored_session["display_name"],
            "email": stored_session["email"],
            "username": stored_session["email"].split("@")[0],
            "picture": stored_session["avatar_url"],
            "is_admin": bool(stored_session["is_admin"]),
        }

    if not user:
        response = JSONResponse({"ok": False, "error": "no_stored_session"}, status_code=404)
        if stored_token:
            response.delete_cookie(cookie_name)
        if db_stored_token:
            response.delete_cookie(db_cookie_name)
        return response

    if db_user and not session_token:
        session_token = secrets.token_urlsafe(48)
        await postgres.create_session(
            user_id=str(db_user["id"]),
            session_token=session_token,
            ip_address=request.client.host if request.client else "",
            user_agent=request.headers.get("user-agent", ""),
            device_type="browser",
        )

    # Make this the active session.
    response_user = {
        "authenticated": True,
        "id": str(db_user["id"]) if db_user else user.get("id", ""),
        "provider": user.get("provider", ""),
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "username": user.get("username", ""),
        "picture": user.get("picture", ""),
        "is_admin": bool(db_user["is_admin"]) if db_user else bool(user.get("is_admin", False)),
    }
    response = JSONResponse({
        "ok": True,
        "user": response_user,
    })
    _issue_session_cookie(response, response_user)
    if session_token:
        _issue_database_session_cookie(response, session_token, target_email)
=======
    # Look up the per-account cookie.
    cookie_name = _email_cookie_name(target_email)
    stored_token = request.cookies.get(cookie_name, "")
    if not stored_token:
        return JSONResponse({"ok": False, "error": "no_stored_session"}, status_code=404)

    # Verify the token is still valid.
    user = _verify_jwt(stored_token)
    if not user:
        # Token expired — clear the stale per-account cookie.
        response = JSONResponse({"ok": False, "error": "session_expired"}, status_code=401)
        response.delete_cookie(cookie_name)
        return response

    # Make this the active session.
    response = JSONResponse({
        "ok": True,
        "user": {
            "authenticated": True,
            "provider": user.get("provider", ""),
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "username": user.get("username", ""),
            "picture": user.get("picture", ""),
        },
    })
    response.set_cookie(
        "session",
        stored_token,
        httponly=True,
        samesite="lax",
        max_age=_TOKEN_MAX_AGE,
        secure=False,
    )
>>>>>>> 082393a (Remove nested repo and clean structure)
    return response


# ── Google OAuth: first-time login ─────────────────────────────────────────────
@router.get("/google/login")
async def google_login(request: Request):
    if not settings.google_client_id or not settings.google_client_secret:
        return JSONResponse({"detail": "Google OAuth is not configured."}, status_code=503)

    state = secrets.token_urlsafe(32)
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": _build_redirect("/api/auth/google/callback"),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
    }
    login_hint = request.query_params.get("login_hint", "")
    expected_email = request.query_params.get("expected_email", "")
<<<<<<< HEAD
    flow = request.query_params.get("flow", "redirect").strip().lower()
    if login_hint:
        params["login_hint"] = login_hint
        params["prompt"] = "none"

    response = RedirectResponse(f"{_GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}")
    response.set_cookie(
        _GOOGLE_FLOW_COOKIE,
        flow if flow == "popup" else "redirect",
        httponly=True,
        samesite=settings.cookie_samesite,
        max_age=_STATE_MAX_AGE,
        secure=settings.cookie_secure,
    )
    response.set_cookie(
        _GOOGLE_STATE_COOKIE,
        state,
        httponly=True,
        samesite=settings.cookie_samesite,
        max_age=_STATE_MAX_AGE,
        secure=settings.cookie_secure,
    )
=======
    if login_hint:
        params["login_hint"] = login_hint

    response = RedirectResponse(f"{_GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}")
    response.set_cookie(_GOOGLE_STATE_COOKIE, state, httponly=True, samesite="lax", max_age=_STATE_MAX_AGE)
>>>>>>> 082393a (Remove nested repo and clean structure)
    if expected_email:
        response.set_cookie(
            _GOOGLE_EXPECTED_EMAIL_COOKIE,
            expected_email,
            httponly=True,
<<<<<<< HEAD
            samesite=settings.cookie_samesite,
            max_age=_STATE_MAX_AGE,
            secure=settings.cookie_secure,
=======
            samesite="lax",
            max_age=_STATE_MAX_AGE,
>>>>>>> 082393a (Remove nested repo and clean structure)
        )
    else:
        response.delete_cookie(_GOOGLE_EXPECTED_EMAIL_COOKIE)
    return response


@router.get("/google/callback")
async def google_callback(request: Request, code: str = "", state: str = "", error: str = ""):
    saved_state = request.cookies.get(_GOOGLE_STATE_COOKIE, "")
    expected_email = request.cookies.get(_GOOGLE_EXPECTED_EMAIL_COOKIE, "")
<<<<<<< HEAD
    flow = request.cookies.get(_GOOGLE_FLOW_COOKIE, "redirect")

    # Handle Google error responses (e.g., prompt=none returning interaction_required).
    if error:
        if flow == "popup":
            response = _build_popup_response("error", error=error)
            _clear_google_oauth_cookies(response)
            return response
=======

    # Handle Google error responses (e.g., prompt=none returning interaction_required).
    if error:
>>>>>>> 082393a (Remove nested repo and clean structure)
        response = RedirectResponse(f"/?auth_error={urllib.parse.quote(error)}")
        _clear_google_oauth_cookies(response)
        return response

    if not saved_state or not hmac.compare_digest(saved_state, state):
<<<<<<< HEAD
        if flow == "popup":
            response = _build_popup_response("error", error="invalid_state")
            _clear_google_oauth_cookies(response)
            return response
=======
>>>>>>> 082393a (Remove nested repo and clean structure)
        response = RedirectResponse("/?auth_error=invalid_state")
        _clear_google_oauth_cookies(response)
        return response

    if not code:
<<<<<<< HEAD
        if flow == "popup":
            response = _build_popup_response("error", error="missing_code")
            _clear_google_oauth_cookies(response)
            return response
=======
>>>>>>> 082393a (Remove nested repo and clean structure)
        response = RedirectResponse("/?auth_error=missing_code")
        _clear_google_oauth_cookies(response)
        return response

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            token_response = await client.post(
                _GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "redirect_uri": _build_redirect("/api/auth/google/callback"),
                    "grant_type": "authorization_code",
                },
            )
            token_response.raise_for_status()
            token_payload = token_response.json()

            user_response = await client.get(
                _GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {token_payload['access_token']}"},
            )
            user_response.raise_for_status()
            info = user_response.json()
    except httpx.HTTPError:
<<<<<<< HEAD
        if flow == "popup":
            response = _build_popup_response("error", error="token_exchange")
            _clear_google_oauth_cookies(response)
            return response
=======
>>>>>>> 082393a (Remove nested repo and clean structure)
        response = RedirectResponse("/?auth_error=token_exchange")
        _clear_google_oauth_cookies(response)
        return response

    provider_email = str(info.get("email", "")).strip().lower()
    is_verified = bool(info.get("email_verified", False))
    if not provider_email or not is_verified:
<<<<<<< HEAD
        if flow == "popup":
            response = _build_popup_response("error", error="email_invalid")
            _clear_google_oauth_cookies(response)
            return response
=======
>>>>>>> 082393a (Remove nested repo and clean structure)
        response = RedirectResponse("/?auth_error=email_invalid")
        _clear_google_oauth_cookies(response)
        return response

    if expected_email and provider_email != expected_email.strip().lower():
<<<<<<< HEAD
        if flow == "popup":
            response = _build_popup_response("error", error="email_mismatch")
            _clear_google_oauth_cookies(response)
            return response
=======
>>>>>>> 082393a (Remove nested repo and clean structure)
        response = RedirectResponse("/?auth_error=email_mismatch")
        _clear_google_oauth_cookies(response)
        return response

    user = {
        "provider": "google",
<<<<<<< HEAD
=======
        "id": info.get("sub", ""),
>>>>>>> 082393a (Remove nested repo and clean structure)
        "name": info.get("name", ""),
        "email": provider_email,
        "username": provider_email.split("@")[0] if provider_email else "",
        "picture": info.get("picture", ""),
    }

<<<<<<< HEAD
    postgres = request.app.state.postgres
    db_user = await postgres.upsert_oauth_user(
        email=provider_email,
        display_name=user["name"],
        handle=user["username"],
        avatar_url=user["picture"],
        provider="google",
        provider_id=str(info.get("sub", "")),
    )
    session_token = secrets.token_urlsafe(48)
    await postgres.create_session(
        user_id=str(db_user["id"]),
        session_token=session_token,
        ip_address=request.client.host if request.client else "",
        user_agent=request.headers.get("user-agent", ""),
        device_type="browser",
    )
    await postgres.record_login_event(
        user_id=str(db_user["id"]),
        email=provider_email,
        provider="google",
        success=True,
        ip_address=request.client.host if request.client else "",
        user_agent=request.headers.get("user-agent", ""),
    )
    user["id"] = str(db_user["id"])
    user["is_admin"] = bool(db_user.get("is_admin"))

    if flow == "popup":
        jwt_token = _create_jwt({**user, "exp": int(time.time()) + _TOKEN_MAX_AGE})
        response = _build_popup_response("success", user=user, session_token=session_token, jwt_token=jwt_token)
        _clear_google_oauth_cookies(response)
        _issue_session_cookie(response, user)
        _issue_database_session_cookie(response, session_token, provider_email)
        return response

    response = RedirectResponse("/?auth=success")
    _clear_google_oauth_cookies(response)
    _issue_session_cookie(response, user)
    _issue_database_session_cookie(response, session_token, provider_email)
=======
    response = RedirectResponse("/?auth=success")
    _clear_google_oauth_cookies(response)
    _issue_session_cookie(response, user)
>>>>>>> 082393a (Remove nested repo and clean structure)
    return response


@router.get("/me")
async def get_me(request: Request):
    token = request.cookies.get("session", "")
    user = _verify_jwt(token) if token else None
    if not user:
<<<<<<< HEAD
        qtoken = request.cookies.get("qsession", "")
        if qtoken:
            session = await request.app.state.postgres.get_session(qtoken)
            if session:
                user_data = {
                    "authenticated": True,
                    "id": str(session["user_id"]),
                    "email": session["email"],
                    "name": session["display_name"],
                    "picture": session["avatar_url"],
                    "provider": session["provider"],
                    "is_admin": session["is_admin"],
                }
                response = JSONResponse(user_data)
                _issue_session_cookie(response, {
                    **user_data,
                    "username": session["email"].split("@")[0],
                })
                _issue_database_session_cookie(response, qtoken, session["email"])
                return response
=======
>>>>>>> 082393a (Remove nested repo and clean structure)
        return JSONResponse({"authenticated": False}, status_code=401)

    user_data = {
        "authenticated": True,
<<<<<<< HEAD
        "id": user.get("id", ""),
=======
>>>>>>> 082393a (Remove nested repo and clean structure)
        "provider": user.get("provider", ""),
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "username": user.get("username", ""),
        "picture": user.get("picture", ""),
<<<<<<< HEAD
        "is_admin": bool(user.get("is_admin", False)),
=======
>>>>>>> 082393a (Remove nested repo and clean structure)
    }

    response = JSONResponse(user_data)

    # Backfill per-account cookie if missing (for accounts logged in before
    # multi-session support was added).
    email = user.get("email", "")
    if email:
        cookie_name = _email_cookie_name(email)
        if not request.cookies.get(cookie_name):
            response.set_cookie(
                cookie_name,
                token,
                httponly=True,
<<<<<<< HEAD
                samesite=settings.cookie_samesite,
                max_age=_TOKEN_MAX_AGE,
                secure=settings.cookie_secure,
            )
        qtoken = request.cookies.get("qsession", "")
        session = await request.app.state.postgres.get_session(qtoken) if qtoken else None
        if session and session["email"].lower() == email.strip().lower():
            _issue_database_session_cookie(response, qtoken, email)
=======
                samesite="lax",
                max_age=_TOKEN_MAX_AGE,
                secure=False,
            )
>>>>>>> 082393a (Remove nested repo and clean structure)

    return response


@router.post("/logout")
async def logout(request: Request):
    """Sign out the active account. Per-account cookies for other accounts are kept."""
    # Find the active user's email so we can remove that specific per-account cookie.
    active_token = request.cookies.get("session", "")
    active_user = _verify_jwt(active_token) if active_token else None
<<<<<<< HEAD
    qtoken = request.cookies.get("qsession")
    active_session = None
    if qtoken:
        try:
            active_session = await request.app.state.postgres.get_session(qtoken)
        except Exception:
            active_session = None
=======
>>>>>>> 082393a (Remove nested repo and clean structure)

    response = JSONResponse({"ok": True})
    response.delete_cookie("session")

<<<<<<< HEAD
    if qtoken:
        try:
            await request.app.state.postgres.invalidate_session(qtoken)
        except Exception:
            pass
        response.delete_cookie("qsession")

=======
>>>>>>> 082393a (Remove nested repo and clean structure)
    # Also remove the per-account cookie for the signed-out user.
    if active_user:
        email = active_user.get("email", "")
        if email:
            response.delete_cookie(_email_cookie_name(email))
<<<<<<< HEAD
            response.delete_cookie(_database_email_cookie_name(email))
    elif active_session:
        email = active_session.get("email", "")
        if email:
            response.delete_cookie(_email_cookie_name(email))
            response.delete_cookie(_database_email_cookie_name(email))
=======
>>>>>>> 082393a (Remove nested repo and clean structure)

    return response
