from pydantic import BaseModel, HttpUrl
from typing import Optional, Dict, Any, List

class RepositoryCreate(BaseModel):
    github_url: HttpUrl

class RepositoryResponse(BaseModel):
    id: str
    project_id: str
    stars: int
    forks: int
    contributors: int
    languages: Dict[str, int]
    description: Optional[str]
    license: Optional[str]
    branches: int
    topics: List[str]
    last_synced_at: str
