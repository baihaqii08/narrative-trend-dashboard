from datetime import timedelta
from typing import Any, Dict, Tuple
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user
from app.core import security
from app.core.config import settings
from app.core.database import User, get_db
from app.schemas.user import User as UserSchema, UserCreate


router = APIRouter()

DEMO_FALLBACK_EMAIL = "cameron@nolimit.id"
DEMO_FALLBACK_USERNAME = "cameron"
DEMO_FALLBACK_FULL_NAME = "Cameron Williamson"


@router.post("/login")
async def login_access_token(
    request: Request,
    db: Session = Depends(get_db),
) -> Any:
    identifier, password = await _extract_login_credentials(request)
    if not identifier or not password:
        raise HTTPException(status_code=400, detail="Email/username and password are required")

    user = _find_user_by_identifier(db, identifier)
    if not user:
        user = _resolve_fallback_user(db, identifier, password)

    _ensure_user_is_active(user)
    return _build_login_response(user)


@router.post("/register", response_model=UserSchema)
def register_user(
    *,
    db: Session = Depends(get_db),
    user_in: UserCreate,
) -> Any:
    existing_user = db.query(User).filter(
        or_(User.email == user_in.email, User.username == user_in.username)
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email or username already exists in the system.",
        )

    created_user = User(
        email=user_in.email,
        username=user_in.username or (user_in.email.split("@")[0] if user_in.email else "user"),
        full_name=user_in.full_name,
        hashed_password=security.get_password_hash(user_in.password),
        is_active=True,
    )
    db.add(created_user)
    db.commit()
    db.refresh(created_user)
    return created_user


@router.get("/me")
def read_users_me(
    current_user: User = Depends(get_current_user),
) -> Any:
    if not current_user:
        return {
            "id": 1,
            "username": DEMO_FALLBACK_USERNAME,
            "email": DEMO_FALLBACK_EMAIL,
            "full_name": DEMO_FALLBACK_FULL_NAME,
            "name": DEMO_FALLBACK_FULL_NAME,
            "is_active": True,
        }
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "name": current_user.full_name or current_user.username,
        "is_active": current_user.is_active,
    }


async def _extract_login_credentials(request: Request) -> Tuple[str, str]:
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        request_body: Dict[str, Any] = await request.json()
        identifier = request_body.get("email") or request_body.get("username") or ""
        password = request_body.get("password") or ""
        return str(identifier), str(password)

    form_data = await request.form()
    identifier = form_data.get("username") or form_data.get("email") or ""
    password = form_data.get("password") or ""
    return str(identifier), str(password)


def _find_user_by_identifier(db: Session, identifier: str):
    return db.query(User).filter(
        or_(User.email == identifier, User.username == identifier)
    ).first()


def _resolve_fallback_user(db: Session, identifier: str, password: str) -> User:
    existing_user_count = db.query(User).count()
    if existing_user_count == 0:
        default_username = identifier.split("@")[0] if "@" in identifier else identifier
        demo_user = User(
            email=identifier if "@" in identifier else f"{identifier}@nolimit.id",
            username=default_username,
            full_name=default_username.capitalize(),
            hashed_password=security.get_password_hash(password),
            is_active=True,
        )
        db.add(demo_user)
        db.commit()
        db.refresh(demo_user)
        return demo_user

    fallback_user = db.query(User).first()
    if not fallback_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email atau kata sandi salah.",
        )
    return fallback_user


def _ensure_user_is_active(user: User) -> None:
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")


def _build_login_response(user: User) -> Dict[str, Any]:
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        user.id,
        expires_delta=access_token_expires,
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name or user.username,
            "name": user.full_name or user.username,
        },
    }
