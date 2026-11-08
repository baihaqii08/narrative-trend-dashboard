from datetime import datetime, timedelta
from typing import Any, Optional, Union
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    expiration_time = _resolve_expiration_time(expires_delta)
    token_payload = {"exp": expiration_time, "sub": str(subject)}
    return jwt.encode(
        token_payload,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def _resolve_expiration_time(expires_delta: Optional[timedelta]) -> datetime:
    if expires_delta:
        return datetime.utcnow() + expires_delta
    return datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
