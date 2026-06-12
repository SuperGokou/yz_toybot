"""
Pydantic schemas for API request/response models.
"""

from typing import Optional, List
from pydantic import BaseModel, EmailStr


class ChatMessage(BaseModel):
    """A single message in conversation history."""
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    """Chat message request."""
    message: str
    mode: str = "chat"  # chat, story, learning, game
    language: Optional[str] = None  # sticky language preference (e.g. "zh", "en", "es", "ja")
    history: Optional[List[ChatMessage]] = None  # recent conversation history


class ChatResponse(BaseModel):
    """Chat message response."""
    response: str
    mode: Optional[str] = None
    action: Optional[str] = None
    language: Optional[str] = None


class ModeInfo(BaseModel):
    """Chat mode information."""
    mode: str
    title: str
    subtitle: str


class StatusResponse(BaseModel):
    """System status response."""
    status: str
    owner_registered: bool
    robot_name: str
    personality: str
    parent_registered: bool = False


class SettingsResponse(BaseModel):
    """Settings response."""
    tts_enabled: bool
    volume: int
    current_mode: str
    voice_registered: bool
    memory_count: int


class SettingsUpdate(BaseModel):
    """Settings update request."""
    tts_enabled: Optional[bool] = None
    volume: Optional[int] = None


class ParentProfile(BaseModel):
    """Parent registration profile."""
    parent_name: str
    parent_email: str
    child_name: str
    child_age: int
    child_interests: Optional[List[str]] = []
    daily_report_enabled: bool = True
    report_time: str = "18:00"


class DailyReport(BaseModel):
    """Daily learning report."""
    id: str
    date: str
    child_name: str
    summary: str
    topics_discussed: List[str]
    skills_practiced: List[str]
    mood: str
    recommendations: List[str]
    interaction_count: int
    total_minutes: int


class InteractionLog(BaseModel):
    """Single interaction log entry."""
    timestamp: str
    mode: str
    user_message: str
    bot_response: str
    topic: Optional[str] = None


class MemoryRequest(BaseModel):
    """Memory save request."""
    content: str
    category: str = "general"  # general, preference, family, achievement, school, hobby
