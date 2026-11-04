from datetime import timedelta
from typing import Any, Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import or_
import uuid

from app.core import security
from app.core.config import settings
from app.api.dependencies import get_db, get_current_user
from models import User
from app.schemas import user as schemas

router = APIRouter()

@router.post("/login", response_model=schemas.Token)
async def login_access_token(
    request: Request,
    db: Session = Depends(get_db)
) -> Any:
    """
    Login with Email or Username and Password.
    Supports JSON body ({"email": "...", "password": "..."}) and Form Data.
    """
    content_type = request.headers.get("content-type", "")
    username_or_email = None
    password = None

    if "application/json" in content_type:
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Format JSON tidak valid")
        username_or_email = body.get("email") or body.get("username")
        password = body.get("password")
    else:
        # Form Data fallback (Swagger UI OAuth2 / x-www-form-urlencoded)
        form = await request.form()
        username_or_email = form.get("username") or form.get("email")
        password = form.get("password")

    if not username_or_email or not password:
        raise HTTPException(
            status_code=400,
            detail="Email/Username dan Password harus diisi"
        )

    # Search by email or username
    user = db.query(User).filter(
        or_(User.email == username_or_email, User.username == username_or_email)
    ).first()

    if not user or not security.verify_password(password, user.password_hash):
        raise HTTPException(status_code=400, detail="Email/Username atau password salah")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="User tidak aktif")
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.username or user.email, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

@router.post("/register", response_model=schemas.User)
def register_user(
    *,
    db: Session = Depends(get_db),
    user_in: schemas.UserCreate,
) -> Any:
    """
    Create new user. Mendukung pendaftaran dengan email dan password.
    """
    identifier = user_in.email or user_in.username
    if not identifier:
        raise HTTPException(status_code=400, detail="Email atau Username wajib diisi")

    # Otomatis buat username dari email jika tidak diisi
    username = user_in.username or (user_in.email.split("@")[0] if user_in.email else "user")
    email = user_in.email

    # Cek apakah user sudah terdaftar berdasarkan username atau email
    existing = db.query(User).filter(
        or_(
            User.username == username,
            (User.email == email) if email else False
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="User dengan email atau username ini sudah terdaftar.",
        )

    user = User(
        username=username,
        email=email,
        full_name=user_in.full_name or username,
        password_hash=security.get_password_hash(user_in.password),
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.get("/me", response_model=schemas.User)
def read_users_me(
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Get current user.
    """
    return current_user

@router.post("/logout")
def logout() -> Any:
    """
    Logout user.
    """
    return {"message": "Successfully logged out. Please clear your token from local storage."}
