from pydantic import BaseModel, EmailStr
from enum import Enum
from typing import Optional
from datetime import datetime


class UserRole(str, Enum):
    admin = "admin"
    user = "user"
    reviewer = "reviewer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    role: UserRole
    sede_id: Optional[int] = None
    sede_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    created_at: Optional[datetime] = None


class SedeOption(BaseModel):
    """Public list item for sede dropdown (e.g. registration form)."""
    id: int
    name: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
