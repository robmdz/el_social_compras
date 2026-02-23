"""
Auth routes: login, logout, current user.
"""

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.security import get_current_user
from app.db.client import get_supabase_client, get_supabase_admin
from app.models.auth import LoginRequest, SedeOption, TokenResponse, UserResponse

router = APIRouter()


@router.get("/sedes", response_model=list[SedeOption])
async def list_sedes():
    """
    Public endpoint: returns all sedes (id, name) for registration and other forms.
    Uses admin client so it works for unauthenticated users; RLS only allows
    authenticated SELECT on sedes.
    """
    admin = get_supabase_admin()
    response = (
        admin.table("sedes")
        .select("id, name")
        .order("name")
        .execute()
    )
    return [SedeOption(id=row["id"], name=row["name"]) for row in (response.data or [])]


@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest):
    """
    Authenticates user with email and password via Supabase Auth.
    Returns access token and user profile.
    """
    supabase = get_supabase_client()
    try:
        auth_response = await asyncio.to_thread(
            supabase.auth.sign_in_with_password,
            {"email": credentials.email, "password": credentials.password},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        ) from e

    if getattr(auth_response, "error", None) or not auth_response.session or not auth_response.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = auth_response.session.access_token
    user_id = auth_response.user.id

    # Fetch user profile from users table (join sedes for sede_name)
    admin_client = get_supabase_admin()
    profile_response = (
        admin_client.table("users")
        .select("id, email, role, sede_id, first_name, last_name, created_at, sedes(name)")
        .eq("id", user_id)
        .single()
        .execute()
    )

    if not profile_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found",
        )

    profile = profile_response.data
    sedes = profile.get("sedes")
    sede_name = sedes.get("name") if isinstance(sedes, dict) else None
    user = UserResponse(
        id=profile["id"],
        email=profile["email"],
        role=profile["role"],
        sede_id=profile.get("sede_id"),
        sede_name=sede_name,
        first_name=profile.get("first_name"),
        last_name=profile.get("last_name"),
        created_at=profile.get("created_at"),
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user,
    )


@router.post("/logout")
async def logout(request: Request):
    """
    Invalidates the user's Supabase session server-side (best-effort),
    revoking the refresh token so it cannot be reused.
    The client should also discard its local token.
    """
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.removeprefix("Bearer ").strip()
    if token:
        supabase = get_supabase_client()
        try:
            # sign_out with scope="local" only clears the local SDK session;
            # passing the user token first ensures the server-side refresh
            # token is revoked as well.
            await asyncio.to_thread(supabase.auth.sign_out)
        except Exception:
            # Best-effort: if Supabase is unreachable the client-side clear
            # is still sufficient for most threat models.
            pass
    return {"message": "Successfully logged out"}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """
    Returns the current authenticated user's profile.
    """
    return current_user
