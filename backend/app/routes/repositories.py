import httpx
from fastapi import APIRouter, HTTPException, Depends, Header
from app.schemas.repositories import RepositoryCreate
from app.db import supabase
from app.services.github import fetch_github_repo_data, fetch_github_commit_activity
from app.services.project import create_project_and_repo
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

    # 3. Check for duplicate: reject if this user already has this repo URL
    try:
        supabase.auth.set_session(access_token=token, refresh_token="")
    except Exception:
        pass
    existing = supabase.table("projects").select("id").eq("user_id", user_id).eq("github_url", url_str).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="You have already added this repository.")

    # 4. Fetch from GitHub API via service
    try:
        github_data = await fetch_github_repo_data(owner, repo)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    # 5. Insert Project into Supabase via service
    try:
        project_obj, repository_obj = create_project_and_repo(
            token=token,
            user_id=user_id,
            repo_name=repo_name,
            github_url=url_str,
            github_data=github_data
        )
        return {"data": {"project": project_obj, "repository": repository_obj}, "error": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/{project_id}/commit-activity")
async def get_commit_activity(project_id: str, token: str = Depends(get_auth_token)):
    """
    Return stored commit activity for a project's repository.
    If data is stale or empty, try fetching fresh data from GitHub.
    """
    try:
        supabase.auth.set_session(access_token=token, refresh_token="")
    except Exception:
        pass  # Best-effort; RLS may still work via service key

    # Get project and repo
    project_res = supabase.table("projects").select("*, repositories(*)").eq("id", project_id).execute()
    if not project_res.data:
        raise HTTPException(status_code=404, detail="Project not found")

    project = project_res.data[0]
    repos = project.get("repositories", [])
    repo = repos[0] if repos else None

    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    commit_activity = repo.get("commit_activity", [])

    # If no data, try fetching from GitHub
    if not commit_activity:
        url_str = project["github_url"]
        match = re.search(r"github\.com/([^/]+)/([^/]+?)(?:\.git)?$", url_str)
        if match:
            owner, repo_name = match.groups()
            
            fresh_activity = await fetch_github_commit_activity(owner, repo_name)
            if fresh_activity:
                commit_activity = fresh_activity
                # Store for next time
                supabase.table("repositories").update(
                    {"commit_activity": commit_activity}
                ).eq("id", repo["id"]).execute()

    return {"data": {"commit_activity": commit_activity}, "error": None}


@router.delete("/{project_id}")
async def delete_project(project_id: str, token: str = Depends(get_auth_token)):
    """
    Delete a project and its associated repository (cascades via FK).
    Only the owning user can delete their own projects (enforced by RLS).
    """
    user_res = supabase.auth.get_user(token)
    if not user_res or not user_res.user:
        raise HTTPException(status_code=401, detail="Invalid user token")

    try:
        supabase.auth.set_session(access_token=token, refresh_token="")
    except Exception:
        pass

    # Verify the project belongs to this user before deleting
    check = supabase.table("projects").select("id").eq("id", project_id).eq("user_id", user_res.user.id).execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="Project not found")

    supabase.table("projects").delete().eq("id", project_id).execute()
    return {"data": {"deleted": True}, "error": None}
