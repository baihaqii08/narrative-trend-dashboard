from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import ValidationError
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import SessionLocal
from app.schemas import user as user_schemas
from models import User


reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)


def get_db() -> Generator:
    database_session = SessionLocal()
    try:
        yield database_session
    finally:
        database_session.close()


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(reusable_oauth2),
) -> User:
    token_data = _decode_access_token(token)
    matched_user = (
        db.query(User)
        .filter(or_(User.username == token_data.sub, User.email == token_data.sub))
        .first()
    )
    if not matched_user:
        raise HTTPException(status_code=404, detail="User not found")
    return matched_user


def _decode_access_token(token: str) -> user_schemas.TokenPayload:
    try:
        decoded_payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        return user_schemas.TokenPayload(**decoded_payload)
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
