from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings


JWT_SIGNING_ALGORITHM = "HS256"
password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    expiration_time = _resolve_token_expiration(expires_delta)
    token_payload = {"exp": expiration_time, "sub": str(subject)}
    return jwt.encode(
        token_payload,
        settings.SECRET_KEY,
        algorithm=JWT_SIGNING_ALGORITHM,
    )


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return password_context.hash(password)


def _resolve_token_expiration(expires_delta: Optional[timedelta]) -> datetime:
    current_utc_time = datetime.now(timezone.utc)
    if expires_delta is not None:
        return current_utc_time + expires_delta
    return current_utc_time + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
