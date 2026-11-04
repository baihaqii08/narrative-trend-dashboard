from pydantic import BaseModel
from typing import Optional

# Shared properties
class UserBase(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None

# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str

# Properties to receive via API on update
class UserUpdate(UserBase):
    password: Optional[str] = None

class UserInDBBase(UserBase):
    id: int
    is_active: bool

    model_config = {"from_attributes": True}

# Additional properties to return via API
class User(UserInDBBase):
    pass

# Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None

# Login schema
class LoginRequest(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None
    password: str
