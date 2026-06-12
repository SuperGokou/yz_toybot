"""
Chat API endpoints.
"""

import json
import re
import threading
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..models import ChatRequest, ChatResponse, ModeInfo
from ..core.dependencies import get_llm_client, get_memory_manager
from ..services.interactions import save_interaction

router = APIRouter()


def detect_input_language(text: str) -> Optional[str]:
    """Detect language from user input text. Returns language code or None if ambiguous."""
    # Japanese-specific characters (Hiragana, Katakana) take priority
    if any('\u3040' <= c <= '\u30ff' for c in text):
        return "ja"
    # Chinese characters (CJK Unified Ideographs)
    if any('\u4e00' <= c <= '\u9fff' for c in text):
        return "zh"
    # Spanish indicators
    spanish_chars = set('ñ¿¡áéíóúü')
    spanish_words = {'hola', 'qué', 'cómo', 'por', 'para', 'está', 'esto', 'muy', 'bien'}
    text_lower = text.lower()
    words = set(re.findall(r'\w+', text_lower))
    if any(c in text for c in spanish_chars) or words & spanish_words:
        return "es"
    return None


# Mode information
MODE_INFO = {
    "chat": {
        "title": "Chat",
        "subtitle": "Let's talk about anything!"
    },
    "story": {
        "title": "Story Time",
        "subtitle": "Adventures await!"
    },
    "learning": {
        "title": "Learning",
        "subtitle": "Discover new things!"
    },
    "game": {
        "title": "Game Mode",
        "subtitle": "Let's play!"
    }
}


@router.get("/modes")
async def get_modes():
    """Get available chat modes."""
    return [
        ModeInfo(mode=key, title=info["title"], subtitle=info["subtitle"])
        for key, info in MODE_INFO.items()
    ]


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Send a message and get a response.
    
    Supports different modes: chat, story, learning, game.
    """
    llm_client = get_llm_client()
    memory_manager = get_memory_manager()
    
    if not llm_client:
        raise HTTPException(status_code=503, detail="LLM client not initialized")
    
    try:
        # Import here to avoid circular imports
        from ..core.response_parser import parse_response
        
        # Detect language from user input and update sticky language
        detected_lang = detect_input_language(request.message)
        effective_language = detected_lang if detected_lang else request.language

        # Query RAG for context
        context_chunks = memory_manager.query_memory(request.message) if memory_manager else []

        # Convert history to dicts for LLM client
        history = [{"role": m.role, "content": m.content} for m in request.history] if request.history else None

        # Get LLM response
        response = llm_client.get_response(
            request.message,
            context_chunks,
            mode=request.mode,
            language=effective_language,
            history=history
        )

        # Parse response for commands
        commands, clean_response = parse_response(response)

        # Log interaction for daily reports
        save_interaction(request.mode, request.message, clean_response)

        # Auto-learning in background
        if memory_manager:
            def auto_learn():
                try:
                    fact = llm_client.extract_personal_info(request.message)
                    if fact:
                        memory_manager.add_memory(fact)
                except Exception as e:
                    print(f"[AutoLearn] Error: {e}")

            thread = threading.Thread(target=auto_learn, daemon=True)
            thread.start()

        return ChatResponse(
            response=clean_response,
            mode=commands.get("mode"),
            action=commands.get("action"),
            language=commands.get("language")
        )
        
    except Exception as e:
        print(f"[Chat] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    Stream a chat response for lower latency.
    
    Returns Server-Sent Events (SSE) stream.
    """
    llm_client = get_llm_client()
    memory_manager = get_memory_manager()
    
    if not llm_client:
        raise HTTPException(status_code=503, detail="LLM client not initialized")
    
    async def generate():
        try:
            from ..core.response_parser import parse_response

            detected_lang = detect_input_language(request.message)
            effective_language = detected_lang if detected_lang else request.language

            context_chunks = memory_manager.query_memory(request.message) if memory_manager else []
            history = [{"role": m.role, "content": m.content} for m in request.history] if request.history else None

            full_response = ""
            for chunk in llm_client.get_response_stream(
                request.message,
                context_chunks,
                mode=request.mode,
                language=effective_language,
                history=history
            ):
                full_response += chunk
                yield f"data: {chunk}\n\n"
            
            # Parse final response for commands
            commands, _ = parse_response(full_response)
            if commands:
                yield f"event: commands\ndata: {json.dumps(commands)}\n\n"
            
            yield "event: done\ndata: \n\n"
            
        except Exception as e:
            yield f"event: error\ndata: {str(e)}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.delete("/chat/history")
async def clear_chat_history():
    """Clear chat history (client-side, but API endpoint for consistency)."""
    return {"success": True, "message": "Chat history cleared"}
