"""
RepoTutor FastAPI application — Phase 7 hardened.

Changes:
  P7-D: SlowAPI rate limiting mounted
  P7-F: Structured JSON logging + RequestLoggingMiddleware
  P7-G: Admin routes mounted at /api/admin
"""
import os
import sys
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

# ── P7-F: Structured JSON logging ─────────────────────────────────────────────
try:
    from pythonjsonlogger import jsonlogger  # type: ignore

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        jsonlogger.JsonFormatter(
            "%(asctime)s %(levelname)s %(name)s %(message)s",
            rename_fields={"asctime": "ts", "levelname": "level", "name": "logger"},
        )
    )
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").handlers.clear()
    logging.getLogger("uvicorn.access").propagate = True
except ImportError:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

logger = logging.getLogger(__name__)

# ── App ────────────────────────────────────────────────────────────────────────
from app.routes import repositories, parsing, projects, jobs, chats, intelligence, training
from app.routes import admin as admin_router

app = FastAPI(title="RepoTutor API", version="2.0.0")

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── P7-F: Request logging middleware ──────────────────────────────────────────
from app.middleware.logging_middleware import RequestLoggingMiddleware
app.add_middleware(RequestLoggingMiddleware)

# ── P7-D: Rate limiting ───────────────────────────────────────────────────────
try:
    from slowapi import _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from app.middleware.rate_limiter import limiter

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    logger.info("[RateLimit] slowapi rate limiter active")
except Exception as e:
    logger.warning(f"[RateLimit] Could not initialise rate limiter: {e}")


# ── Exception handlers ────────────────────────────────────────────────────────
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"data": None, "error": {"code": "HTTP_ERROR", "message": str(exc.detail)}},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    origin = request.headers.get("origin", "")
    allowed = ["http://localhost:5173", "http://127.0.0.1:5173"]
    headers = {}
    if origin in allowed:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    logger.exception("Unhandled exception", extra={"path": request.url.path, "error": str(exc)})
    return JSONResponse(
        status_code=500,
        content={"data": None, "error": {"code": "INTERNAL_SERVER_ERROR", "message": str(exc)}},
        headers=headers,
    )


# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health_check():
    return {"data": {"status": "ok", "version": "2.0.0"}, "error": None}


# ── Routes ─────────────────────────────────────────────────────────────────────
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(chats.router, prefix="/api", tags=["Chats"])
app.include_router(intelligence.router, prefix="/api/projects", tags=["Intelligence"])
app.include_router(training.router, prefix="/api/projects", tags=["Training"])
app.include_router(repositories.router, prefix="/api/repositories", tags=["Repositories"])
app.include_router(parsing.router, prefix="/api/repositories", tags=["Parsing"])

# P7-G: Admin routes
app.include_router(admin_router.router, prefix="/api/admin", tags=["Admin"])


@app.get("/")
def read_root():
    return {"data": {"message": "Welcome to RepoTutor API v2"}, "error": None}
