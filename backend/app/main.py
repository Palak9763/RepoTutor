import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.routes import repositories, parsing, projects, jobs, chats, intelligence, training

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(title="RepoTutor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler — ensures CORS headers are present even on 500s.
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "data": None,
            "error": {
                "code": "HTTP_ERROR",
                "message": str(exc.detail)
            }
        },
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    origin = request.headers.get("origin", "")
    allowed = ["http://localhost:5173", "http://127.0.0.1:5173"]
    headers = {}
    if origin in allowed:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    logging.getLogger(__name__).exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "data": None,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": str(exc)
            }
        },
        headers=headers,
    )

@app.get("/api/health")
def health_check():
    return {
        "data": {
            "status": "ok",
            "version": "1.0.0"
        },
        "error": None
    }

# Mount primary Phase 1 routes
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(chats.router, prefix="/api", tags=["Chats"])
app.include_router(intelligence.router, prefix="/api/projects", tags=["Intelligence"])

# Mount Phase 5 training routes
app.include_router(training.router, prefix="/api/projects", tags=["Training"])

# Mount legacy/phase 2 routes
app.include_router(repositories.router, prefix="/api/repositories", tags=["Repositories"])
app.include_router(parsing.router, prefix="/api/repositories", tags=["Parsing"])

@app.get("/")
def read_root():
    return {"data": {"message": "Welcome to RepoTutor API"}, "error": None}
