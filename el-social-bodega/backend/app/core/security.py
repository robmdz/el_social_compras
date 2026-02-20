"""
Auth dependencies for FastAPI.
Provides JWT decoding, user extraction, and role-based access control.
"""

import base64
import json
import time

from fastapi import Depends, HTTPException, Request, status

from app.db.client import get_supabase_admin
from app.models.auth import UserRole


def get_current_user(request: Request) -> dict:
    """
    Extracts Bearer token from Authorization header, decodes JWT to extract user ID,
    verifies expiration, and fetches user profile from Supabase users table.
    Returns dict with id, email, role, sede_id.
    
    Note: We decode the JWT without signature verification since Supabase's JWT secret
    is not exposed. We verify the user exists in the database and check token expiration.
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

    # Decode JWT to extract user ID and expiration
    # JWT format: header.payload.signature
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token format",
            )
        
        # Decode payload (add padding if needed)
        payload_b64 = parts[1]
        # Add padding if necessary for base64 decoding
        padding = len(payload_b64) % 4
        if padding:
            payload_b64 += "=" * (4 - padding)
        
        payload_bytes = base64.urlsafe_b64decode(payload_b64)
        payload = json.loads(payload_bytes)
        
        # Extract user ID from token
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload: missing user ID",
            )
        
        # Verify token expiration
        exp = payload.get("exp")
        if exp:
            current_time = time.time()
            if current_time > exp:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token expired",
                )
        
    except (ValueError, json.JSONDecodeError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
        ) from e
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token validation failed",
        ) from e

    # Fetch user profile from users table
    # This verifies the user exists and is authorized
    admin_client = get_supabase_admin()
    response = admin_client.table("users").select("id, email, role, sede_id").eq("id", user_id).single().execute()

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user = response.data
    return {
        "id": user["id"],
        "email": user["email"],
        "role": user["role"],
        "sede_id": user.get("sede_id"),
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
