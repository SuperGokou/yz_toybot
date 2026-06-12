"""
Parent registration and daily reports API endpoints.
"""

import json
from datetime import datetime, date
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks

from ..models import ParentProfile, DailyReport
from ..config import DATA_DIR
from ..core.dependencies import get_llm_client, get_memory_manager
from ..services.email import send_report_email

router = APIRouter()

# File paths for persistent storage
PARENT_PROFILE_FILE = DATA_DIR / "parent_profile.json"
INTERACTIONS_FILE = DATA_DIR / "daily_interactions.json"
REPORTS_FILE = DATA_DIR / "daily_reports.json"

# In-memory storage (loaded from files)
_parent_profile: Optional[dict] = None
_daily_interactions: list = []


def load_parent_profile():
    """Load parent profile from file."""
    global _parent_profile
    if PARENT_PROFILE_FILE.exists():
        try:
            with open(PARENT_PROFILE_FILE, 'r') as f:
                _parent_profile = json.load(f)
                print(f"[Parent] Loaded profile for {_parent_profile.get('parent_name', 'Unknown')}")
        except Exception as e:
            print(f"[Parent] Error loading profile: {e}")


def save_parent_profile_to_file():
    """Save parent profile to file."""
    global _parent_profile
    if _parent_profile:
        try:
            PARENT_PROFILE_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(PARENT_PROFILE_FILE, 'w') as f:
                json.dump(_parent_profile, f, indent=2)
            print("[Parent] Saved profile")
        except Exception as e:
            print(f"[Parent] Error saving profile: {e}")


def get_parent_profile_data() -> Optional[dict]:
    """Get parent profile data."""
    global _parent_profile
    if _parent_profile is None:
        load_parent_profile()
    return _parent_profile


@router.post("/parent/register")
async def register_parent(profile: ParentProfile):
    """Register parent and child information."""
    global _parent_profile
    
    memory_manager = get_memory_manager()
    
    _parent_profile = {
        "id": f"parent_{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "parent_name": profile.parent_name,
        "parent_email": profile.parent_email,
        "child_name": profile.child_name,
        "child_age": profile.child_age,
        "child_interests": profile.child_interests or [],
        "daily_report_enabled": profile.daily_report_enabled,
        "report_time": profile.report_time,
        "created_at": datetime.now().isoformat(),
    }
    
    save_parent_profile_to_file()
    
    # Save child info to memory for personalization
    if memory_manager:
        memory_manager.add_memory(f"[PROFILE] Child's name is {profile.child_name}, age {profile.child_age}")
        if profile.child_interests:
            interests = ", ".join(profile.child_interests)
            memory_manager.add_memory(f"[PROFILE] {profile.child_name} is interested in: {interests}")
    
    print(f"[Parent] Registered: {profile.parent_name} ({profile.parent_email})")
    
    return {
        "success": True,
        "message": f"Welcome {profile.parent_name}! Registration complete.",
        "id": _parent_profile["id"]
    }


@router.get("/parent/profile")
async def get_parent_profile():
    """Get current parent profile."""
    profile = get_parent_profile_data()
    if not profile:
        return None
    return profile


@router.put("/parent/profile")
async def update_parent_profile(updates: dict):
    """Update parent profile settings."""
    global _parent_profile
    
    if not _parent_profile:
        load_parent_profile()
    
    if not _parent_profile:
        raise HTTPException(status_code=404, detail="No parent profile found")
    
    # Update allowed fields
    allowed_fields = ['parent_name', 'parent_email', 'child_name', 'child_age', 
                      'child_interests', 'daily_report_enabled', 'report_time']
    
    for field in allowed_fields:
        if field in updates:
            _parent_profile[field] = updates[field]
    
    save_parent_profile_to_file()
    
    return {"success": True}


@router.get("/reports")
async def get_daily_reports(limit: int = 7):
    """Get recent daily reports."""
    if not REPORTS_FILE.exists():
        return []
    
    try:
        with open(REPORTS_FILE, 'r') as f:
            reports = json.load(f)
        return reports[-limit:]
    except Exception as e:
        print(f"[Reports] Error loading: {e}")
        return []


@router.post("/reports/generate")
async def generate_daily_report(background_tasks: BackgroundTasks):
    """Generate a daily report for today's interactions."""
    global _daily_interactions
    
    llm_client = get_llm_client()
    parent_profile = get_parent_profile_data()
    
    if not parent_profile:
        raise HTTPException(status_code=404, detail="No parent profile found")
    
    # Load interactions
    if INTERACTIONS_FILE.exists():
        try:
            with open(INTERACTIONS_FILE, 'r') as f:
                data = json.load(f)
                today = date.today().isoformat()
                _daily_interactions = [i for i in data if i.get('date') == today]
        except Exception:
            pass
    
    if not _daily_interactions:
        return {"success": False, "message": "No interactions to report"}
    
    # Generate report using LLM
    child_name = parent_profile.get("child_name", "Your child")
    
    # Prepare interaction summary
    interaction_summary = "\n".join([
        f"- [{i['mode']}] User: {i['user_message'][:100]}... Bot: {i['bot_response'][:100]}..."
        for i in _daily_interactions[-20:]
    ])
    
    prompt = f"""Generate a brief, warm daily learning report for a parent about their child {child_name}.

Today's interactions:
{interaction_summary}

Create a JSON response with:
- summary: 2-3 sentence overview of today's learning
- topics_discussed: list of main topics (max 5)
- skills_practiced: list of skills worked on (max 3)
- mood: one of "happy", "curious", "calm", "energetic"
- recommendations: 2 suggestions for parents (max 2)

Keep it positive and encouraging. Focus on learning achievements."""

    try:
        response = llm_client.get_response(prompt, [], mode="chat")
        
        # Parse JSON from response
        import re
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            report_data = json.loads(json_match.group())
        else:
            report_data = {
                "summary": f"{child_name} had a great learning session today!",
                "topics_discussed": ["general conversation"],
                "skills_practiced": ["communication"],
                "mood": "happy",
                "recommendations": ["Keep encouraging curiosity!"]
            }
        
        report = {
            "id": f"report_{datetime.now().strftime('%Y%m%d')}",
            "date": date.today().isoformat(),
            "child_name": child_name,
            "summary": report_data.get("summary", ""),
            "topics_discussed": report_data.get("topics_discussed", []),
            "skills_practiced": report_data.get("skills_practiced", []),
            "mood": report_data.get("mood", "happy"),
            "recommendations": report_data.get("recommendations", []),
            "interaction_count": len(_daily_interactions),
            "total_minutes": len(_daily_interactions) * 2,
        }
        
        # Save report
        reports = []
        if REPORTS_FILE.exists():
            with open(REPORTS_FILE, 'r') as f:
                reports = json.load(f)
        reports.append(report)
        
        REPORTS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(REPORTS_FILE, 'w') as f:
            json.dump(reports[-30:], f, indent=2)
        
        # Send email in background
        if parent_profile.get("daily_report_enabled"):
            background_tasks.add_task(send_report_email, report, parent_profile)
        
        return {"success": True, "report": report}
        
    except Exception as e:
        print(f"[Reports] Error generating: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reports/test")
async def send_test_report():
    """Send a test report email."""
    parent_profile = get_parent_profile_data()
    
    if not parent_profile:
        raise HTTPException(status_code=404, detail="No parent profile found")
    
    test_report = {
        "id": "test_report",
        "date": date.today().isoformat(),
        "child_name": parent_profile.get("child_name", "Your child"),
        "summary": "This is a test report to verify your email settings are working correctly!",
        "topics_discussed": ["Test topic 1", "Test topic 2"],
        "skills_practiced": ["Communication"],
        "mood": "happy",
        "recommendations": ["This is a test recommendation"],
        "interaction_count": 5,
        "total_minutes": 10,
    }
    
    try:
        await send_report_email(test_report, parent_profile)
        return {"success": True, "message": f"Test report sent to {parent_profile.get('parent_email')}"}
    except Exception as e:
        return {"success": False, "message": str(e)}
