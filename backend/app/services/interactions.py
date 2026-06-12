"""
Interaction tracking service for daily reports.
"""

import json
from datetime import datetime, date
from pathlib import Path
from typing import List, Dict

from ..config import DATA_DIR


INTERACTIONS_FILE = DATA_DIR / "daily_interactions.json"

# In-memory cache
_daily_interactions: List[Dict] = []


def load_interactions() -> List[Dict]:
    """Load today's interactions from file."""
    global _daily_interactions
    
    if INTERACTIONS_FILE.exists():
        try:
            with open(INTERACTIONS_FILE, 'r') as f:
                data = json.load(f)
                # Only load today's interactions
                today = date.today().isoformat()
                _daily_interactions = [i for i in data if i.get('date') == today]
        except Exception as e:
            print(f"[Interactions] Error loading: {e}")
            _daily_interactions = []
    
    return _daily_interactions


def save_interaction(mode: str, user_msg: str, bot_response: str):
    """Save an interaction for daily report."""
    global _daily_interactions
    
    interaction = {
        "timestamp": datetime.now().isoformat(),
        "date": date.today().isoformat(),
        "mode": mode,
        "user_message": user_msg,
        "bot_response": bot_response,
    }
    _daily_interactions.append(interaction)
    
    # Save to file
    try:
        INTERACTIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
        
        # Load existing and append
        existing = []
        if INTERACTIONS_FILE.exists():
            with open(INTERACTIONS_FILE, 'r') as f:
                existing = json.load(f)
        
        existing.append(interaction)
        
        # Keep only last 7 days
        from datetime import timedelta
        cutoff = (date.today() - timedelta(days=7)).isoformat()
        existing = [i for i in existing if i.get('date', '') >= cutoff]
        
        with open(INTERACTIONS_FILE, 'w') as f:
            json.dump(existing, f, indent=2)
            
    except Exception as e:
        print(f"[Interactions] Error saving: {e}")


def get_today_interactions() -> List[Dict]:
    """Get today's interactions."""
    global _daily_interactions
    
    if not _daily_interactions:
        load_interactions()
    
    return _daily_interactions
