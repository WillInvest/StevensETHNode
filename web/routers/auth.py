from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from web.db import get_conn
from web.auth import (
    verify_password, create_token, get_current_user,
    COOKIE_NAME, hash_password,
)

router = APIRouter(tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/auth/login")
async def login(req: LoginRequest, response: Response):
    """Authenticate and set JWT cookie."""
    async with get_conn() as conn:
        # Ensure table exists
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS _users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                hashed_pw TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'viewer',
                created_at TIMESTAMPTZ DEFAULT now()
            )
        """)
        cur = await conn.execute(
            "SELECT username, hashed_pw, role FROM _users WHERE username = %s",
            (req.username,),
        )
        row = await cur.fetchone()

    if row is None or not verify_password(req.password, row[1]):
        raise HTTPException(401, "Invalid credentials")

    token = create_token({"sub": row[0], "role": row[2]})
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=86400,
    )
    return {"username": row[0], "role": row[2]}


@router.post("/auth/logout")
async def logout(response: Response):
    """Clear JWT cookie."""
    response.delete_cookie(COOKIE_NAME)
    return {"status": "logged out"}


@router.get("/auth/me")
async def me(request: Request):
    """Get current user from JWT cookie."""
    user = await get_current_user(request)
    if user is None:
        raise HTTPException(401, "Not authenticated")
    return user
