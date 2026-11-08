from datetime import timedelta
from typing import Any, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user, get_db
from app.core import security
from app.core.config import settings
from app.schemas import user as user_schemas
from models import User


router = APIRouter()


@router.post("/login", response_model=user_schemas.Token)
async def login_access_token(
    request: Request,
    db: Session = Depends(get_db),
) -> Any:
    """Authenticate user via JSON body or OAuth2 form data and issue a Bearer access token."""
    username_or_email, password = await _extract_login_credentials(request)
    if not username_or_email or not password:
        raise HTTPException(
            status_code=400,
            detail="Email/Username dan Password harus diisi",
        )

    authenticated_user = _authenticate_user(db, username_or_email, password)
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token_subject = authenticated_user.username or authenticated_user.email

    return {
        "access_token": security.create_access_token(
            token_subject,
            expires_delta=access_token_expires,
        ),
        "token_type": "bearer",
    }


@router.post("/register", response_model=user_schemas.User)
def register_user(
    *,
    db: Session = Depends(get_db),
    user_in: user_schemas.UserCreate,
) -> Any:
    """Register a new user account after verifying username and email uniqueness."""
    identifier = user_in.email or user_in.username
    if not identifier:
        raise HTTPException(status_code=400, detail="Email atau Username wajib diisi")

    resolved_username = user_in.username or (
        user_in.email.split("@")[0] if user_in.email else "user"
    )
    resolved_email = user_in.email

    if _is_user_already_registered(db, resolved_username, resolved_email):
        raise HTTPException(
            status_code=400,
            detail="User dengan email atau username ini sudah terdaftar.",
        )

    new_user = User(
        username=resolved_username,
        email=resolved_email,
        full_name=user_in.full_name or resolved_username,
        password_hash=security.get_password_hash(user_in.password),
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get("/me", response_model=user_schemas.User)
def read_users_me(
    current_user: User = Depends(get_current_user),
) -> Any:
    return current_user


@router.post("/logout")
def logout() -> Any:
    return {"message": "Successfully logged out. Please clear your token from local storage."}


async def _extract_login_credentials(request: Request) -> Tuple[Optional[str], Optional[str]]:
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Format JSON tidak valid")
        return body.get("email") or body.get("username"), body.get("password")

    form_data = await request.form()
    return form_data.get("username") or form_data.get("email"), form_data.get("password")


def _authenticate_user(
    db: Session,
    username_or_email: str,
    plain_password: str,
) -> User:
    matched_user = (
        db.query(User)
        .filter(
            or_(
                User.email == username_or_email,
                User.username == username_or_email,
            )
        )
        .first()
    )
    if not matched_user or not security.verify_password(plain_password, matched_user.password_hash):
        raise HTTPException(status_code=400, detail="Email/Username atau password salah")
    if not matched_user.is_active:
        raise HTTPException(status_code=400, detail="User tidak aktif")
    return matched_user


def _is_user_already_registered(
    db: Session,
    username: str,
    email: Optional[str],
) -> bool:
    existing_user = (
        db.query(User)
        .filter(
            or_(
                User.username == username,
                (User.email == email) if email else False,
            )
        )
        .first()
    )
    return existing_user is not None
