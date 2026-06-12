"""
Memory/RAG API endpoints.
"""

from fastapi import APIRouter, HTTPException

from ..models import MemoryRequest
from ..core.dependencies import get_memory_manager

router = APIRouter()


@router.get("/memory/stats")
async def get_memory_stats():
    """Get memory/knowledge base statistics."""
    memory_manager = get_memory_manager()
    
    if not memory_manager:
        raise HTTPException(status_code=503, detail="Memory manager not initialized")
    
    return memory_manager.get_stats()


@router.post("/memory/save")
async def save_memory(request: MemoryRequest):
    """
    Manually save a memory/fact about the user.
    
    Categories: general, preference, family, achievement, school, hobby
    """
    memory_manager = get_memory_manager()
    
    if not memory_manager:
        raise HTTPException(status_code=503, detail="Memory manager not initialized")
    
    try:
        # Format with category for better retrieval
        formatted_memory = f"[{request.category.upper()}] {request.content}"
        memory_manager.add_memory(formatted_memory)
        print(f"[Memory] Saved: {formatted_memory}")
        return {"success": True, "message": "Memory saved!"}
    except Exception as e:
        print(f"[Memory] Error saving: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/memory/search")
async def search_memories(query: str, limit: int = 5):
    """
    Search saved memories by semantic similarity.
    """
    memory_manager = get_memory_manager()
    
    if not memory_manager:
        raise HTTPException(status_code=503, detail="Memory manager not initialized")
    
    try:
        results = memory_manager.query_memory(query, n_results=limit)
        return {"results": results, "count": len(results)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
