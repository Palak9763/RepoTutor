import httpx
from fastapi import APIRouter, HTTPException, Depends, Header
from app.schemas.repositories import RepositoryCreate
from app.db import supabase
import re

router = APIRouter()

def get_auth_token(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    return authorization.split(" ")[1]

@router.post("/")
async def create_repository(repo_in: RepositoryCreate, token: str = Depends(get_auth_token)):
    # 1. Validate GitHub URL
    url_str = str(repo_in.github_url)
    match = re.search(r"github\.com/([^/]+)/([^/]+?)(?:\.git)?$", url_str)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid GitHub URL format")
    
    owner, repo = match.groups()
    repo_name = f"{owner}/{repo}"

    # 2. Get user info from Supabase using the token
    user_res = supabase.auth.get_user(token)
    if not user_res or not user_res.user:
        raise HTTPException(status_code=401, detail="Invalid user token")
    
    user_id = user_res.user.id

    # 3. Fetch from GitHub API
    async with httpx.AsyncClient() as client:
        # Base repo info
        gh_res = await client.get(f"https://api.github.com/repos/{owner}/{repo}")
        if gh_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Repository not found on GitHub")
        gh_data = gh_res.json()
        
        # Languages
        lang_res = await client.get(f"https://api.github.com/repos/{owner}/{repo}/languages")
        languages = lang_res.json() if lang_res.status_code == 200 else {}
        
        # Contributors (rough count)
        contrib_res = await client.get(f"https://api.github.com/repos/{owner}/{repo}/contributors?per_page=1")
        # To get real count without pagination, we can check link header, but let's just use a default or 0 for now if no link header
        contributors_count = 0
        if "link" in contrib_res.headers:
            last_link = [l for l in contrib_res.headers["link"].split(",") if 'rel="last"' in l]
            if last_link:
                page_match = re.search(r"page=(\d+)", last_link[0])
                if page_match:
                    contributors_count = int(page_match.group(1))
        elif contrib_res.status_code == 200:
            contributors_count = len(contrib_res.json())

    # 4. Insert Project into Supabase
    project_data = {
        "user_id": user_id,
        "repo_name": repo_name,
        "github_url": url_str,
        "status": "completed"
    }
    
    # We must set the auth header for RLS to work properly, or use a service key.
    # Currently supabase-py doesn't easily let us set auth token for a single query. 
    # For now, we will just insert. RLS might block this if using anon key without setting auth.
    # We will use the user's token directly by setting the session.
    supabase.auth.set_session(access_token=token, refresh_token="")
    
    try:
        project_insert = supabase.table("projects").insert(project_data).execute()
        project_id = project_insert.data[0]["id"]
        
        # 5. Insert Repository into Supabase
        repo_data = {
            "project_id": project_id,
            "stars": gh_data.get("stargazers_count", 0),
            "forks": gh_data.get("forks_count", 0),
            "contributors": contributors_count,
            "languages": languages,
            "description": gh_data.get("description", ""),
            "license": gh_data.get("license", {}).get("name", "") if gh_data.get("license") else "",
            "topics": gh_data.get("topics", [])
        }
        
        repo_insert = supabase.table("repositories").insert(repo_data).execute()
        return {"project": project_insert.data[0], "repository": repo_insert.data[0]}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
