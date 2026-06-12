"""
API Routes for KidBot.
"""

from fastapi import APIRouter

from .chat import router as chat_router
from .voice import router as voice_router
from .parent import router as parent_router
from .memory import router as memory_router

# Main API router
api_router = APIRouter(prefix="/api")

# Include sub-routers
api_router.include_router(chat_router, tags=["Chat"])
api_router.include_router(voice_router, tags=["Voice"])
api_router.include_router(parent_router, tags=["Parent"])
api_router.include_router(memory_router, tags=["Memory"])
