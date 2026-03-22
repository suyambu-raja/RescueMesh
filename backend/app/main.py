"""
RapidRescue Backend — FastAPI Application Entry Point
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db

# Route imports
from app.routes import auth, shelters, zones, messages, sos, location, food, contacts, chat

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / Shutdown lifecycle."""
    # ── Startup ───────────────────────────────
    await init_db()
    print(f"✅  {settings.APP_NAME} v{settings.APP_VERSION} started")
    yield
    # ── Shutdown ──────────────────────────────
    print("🛑  Shutting down…")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Backend API for the RapidRescue disaster-response mobile app.",
    lifespan=lifespan,
    debug=True,
)

# Debug: show full traceback in 500 responses
from fastapi.responses import JSONResponse
import traceback

@app.exception_handler(Exception)
async def debug_exception_handler(request, exc):
    tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
    print("".join(tb))
    return JSONResponse(status_code=500, content={"detail": str(exc), "traceback": "".join(tb[-3:])})

# ── CORS ──────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register Routers ─────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(shelters.router)
app.include_router(zones.router)
app.include_router(messages.router)
app.include_router(sos.router)
app.include_router(location.router)
app.include_router(food.router)
app.include_router(contacts.router)
app.include_router(chat.router)


# ── Health Check ──────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def health_check():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }
