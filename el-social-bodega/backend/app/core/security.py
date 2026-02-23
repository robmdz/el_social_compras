"""
Auth dependencies for FastAPI.
Provides JWT decoding with signature verification (supports both HS256
and ES256/JWKS for newer Supabase projects), user extraction, and
role-based access control.
"""

import time
import logging

import httpx
from jose import jwt, jwk, JWTError

from fastapi import Depends, HTTPException, Request, status

from app.core.config import get_settings
from app.db.client import get_supabase_admin
from app.models.auth import UserRole

logger = logging.getLogger(__name__)

_jwks_cache: dict | None = None
_jwks_cache_ts: float = 0
_JWKS_TTL_SECONDS = 3600


def _fetch_jwks(supabase_url: str) -> list[dict]:
    """
    Fetches the JWKS (JSON Web Key Set) from Supabase's well-known endpoint.
    Caches the result for _JWKS_TTL_SECONDS to avoid fetching on every request.
    """
    global _jwks_cache, _jwks_cache_ts

    now = time.time()
    if _jwks_cache is not None and (now - _jwks_cache_ts) < _JWKS_TTL_SECONDS:
        return _jwks_cache

    url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    try:
        resp = httpx.get(url, timeout=10)
        resp.raise_for_status()
        keys = resp.json().get("keys", [])
        _jwks_cache = keys
        _jwks_cache_ts = now
        logger.info("Fetched %d JWKS keys from Supabase", len(keys))
        return keys
    except Exception as e:
        logger.warning("Failed to fetch JWKS from %s: %s", url, e)
        if _jwks_cache is not None:
            return _jwks_cache
        return []


def _get_es256_key(kid: str, supabase_url: str):
    """Finds the ES256 public key matching the given kid from Supabase JWKS."""
    keys = _fetch_jwks(supabase_url)
    for k in keys:
        if k.get("kid") == kid:
            return jwk.construct(k, algorithm="ES256")
    # kid not found — force-refresh in case keys rotated
    global _jwks_cache_ts
    _jwks_cache_ts = 0
    keys = _fetch_jwks(supabase_url)
    for k in keys:
        if k.get("kid") == kid:
            return jwk.construct(k, algorithm="ES256")
    return None


def get_current_user(request: Request) -> dict:
    """
    Extracts Bearer token from Authorization header, verifies JWT signature,
    and fetches the user profile from the Supabase users table.
    Supports both HS256 (legacy) and ES256 (JWKS) Supabase token formats.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
        )

    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing token",
        )

    settings = get_settings()

    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token header",
        ) from e

    alg = unverified_header.get("alg", "HS256")

    try:
        if alg == "ES256":
            kid = unverified_header.get("kid")
            if not kid:
                raise JWTError("ES256 token missing kid header")
            key = _get_es256_key(kid, settings.supabase_url)
            if key is None:
                raise JWTError(f"No JWKS key found for kid={kid}")
            payload = jwt.decode(
                token,
                key,
                algorithms=["ES256"],
                options={"verify_aud": False},
            )
        else:
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
    except JWTError as e:
        logger.warning("JWT verification failed (alg=%s): %s", alg, e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from e

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload: missing user ID",
        )

    admin_client = get_supabase_admin()
    response = (
        admin_client.table("users")
        .select("id, email, role, sede_id, first_name, last_name")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )

    records = response.data if isinstance(response.data, list) else [response.data]
    records = [r for r in records if r]

    if not records:
        token_email = payload.get("email")
        if token_email:
            raw_meta = payload.get("user_metadata") or {}
            meta_role = raw_meta.get("role", "user")
            if meta_role not in ("admin", "user", "reviewer"):
                meta_role = "user"
            meta_sede = raw_meta.get("sede_id")
            meta_first = raw_meta.get("first_name")
            meta_last = raw_meta.get("last_name")

            admin_client.table("users").insert(
                {
                    "id": user_id,
                    "email": token_email,
                    "role": meta_role,
                    "sede_id": meta_sede,
                    "first_name": meta_first,
                    "last_name": meta_last,
                }
            ).execute()

            retry_response = (
                admin_client.table("users")
                .select("id, email, role, sede_id, first_name, last_name")
                .eq("id", user_id)
                .limit(1)
                .execute()
            )
            retry_records = (
                retry_response.data
                if isinstance(retry_response.data, list)
                else [retry_response.data]
            )
            retry_records = [r for r in retry_records if r]
            if retry_records:
                records = retry_records

    if not records:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User profile not found. Ask an admin to provision your account.",
        )

    user = records[0]
    return {
        "id": user["id"],
        "email": user["email"],
        "role": user["role"],
        "sede_id": user.get("sede_id"),
        "first_name": user.get("first_name"),
        "last_name": user.get("last_name"),
    }


def require_role(*roles: UserRole):
    """
    Returns a dependency that checks if the current user's role
    is in the allowed roles. Raises 403 if not.
    """

    async def _check_role(
        current_user: dict = Depends(get_current_user),
    ) -> dict:
        user_role = current_user.get("role")
        if user_role not in [r.value for r in roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _check_role


require_admin = require_role(UserRole.admin)
require_user_or_admin = require_role(UserRole.admin, UserRole.user)
require_any_role = require_role(UserRole.admin, UserRole.user, UserRole.reviewer)
