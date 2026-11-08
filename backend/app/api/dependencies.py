from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import ValidationError
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core import security
from app.core.config import settings
from app.core.database import SocialPost, User, get_db
from app.schemas.user import TokenPayload


reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=False,
)


def parse_filter_days(
    days: Optional[str] = None,
    timeframe: Optional[str] = None,
) -> Optional[int]:
    """Parse timeframe or days query parameters into an integer day count, or None for all-time."""
    raw_value = str(days or timeframe or "").strip().lower()
    if not raw_value or raw_value in ("all", "semua", "0", "none", "null"):
        return None

    digits_only = "".join(character for character in raw_value if character.isdigit())
    if not digits_only:
        return None

    parsed_days = int(digits_only)
    return parsed_days if parsed_days > 0 else None


def apply_date_filter(query, db: Session, days: Optional[int]):
    """Anchor date window to the latest post timestamp in the dataset so historical datasets remain queryable."""
    if not days or days <= 0:
        return query

    latest_post_date = db.query(func.max(SocialPost.created_at)).scalar()
    if not latest_post_date:
        return query

    cutoff_date = latest_post_date - timedelta(days=days)
    return query.filter(SocialPost.created_at >= cutoff_date)


def apply_platform_filter(query, platform: Optional[str]):
    if not platform or platform.lower() in ("all", "semua"):
        return query

    normalized_platform = platform.lower()
    if normalized_platform in ("x", "twitter"):
        return query.filter(func.lower(SocialPost.platform).in_(["x", "twitter", "tw"]))

    return query.filter(func.lower(SocialPost.platform) == normalized_platform)


def get_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(reusable_oauth2),
) -> Optional[User]:
    if not token:
        return None

    token_Data = _decode_token_payload(token)
    user = db.query(User).filter(User.id == int(token_Data.sub)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _decode_token_payload(token: str) -> TokenPayload:
    try:
        decoded_payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[security.JWT_SIGNING_ALGORITHM],
        )
        return TokenPayload(**decoded_payload)
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
