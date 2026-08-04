from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import repositories

app = FastAPI(title="RepoTutor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], # Set specific origin since credentials are true
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(repositories.router, prefix="/api/repositories", tags=["Repositories"])

@app.get("/")
def read_root():
    return {"message": "Welcome to RepoTutor"}
