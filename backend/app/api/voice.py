"""
Voice API endpoints (TTS, STT, verification).
"""

import os
import tempfile
import subprocess
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse

from ..core.dependencies import get_voice_gatekeeper

router = APIRouter()


# TTS voice mapping for multi-language support
TTS_VOICES = {
    "en": "en-US-AnaNeural",      # English - Ana (child-friendly)
    "zh": "zh-CN-XiaoxiaoNeural", # Chinese - Xiaoxiao (friendly)
    "es": "es-MX-DaliaNeural",    # Spanish - Dalia (Mexican, friendly)
    "ja": "ja-JP-NanamiNeural",   # Japanese - Nanami (friendly)
}


def detect_language(text: str) -> str:
    """Detect language from text and return appropriate TTS voice."""
    # Chinese characters (CJK Unified Ideographs)
    has_chinese = any('\u4e00' <= char <= '\u9fff' for char in text)
    # Japanese-specific characters (Hiragana, Katakana)
    has_japanese = any('\u3040' <= char <= '\u30ff' for char in text)
    
    # Japanese takes priority if it has hiragana/katakana
    if has_japanese:
        return TTS_VOICES["ja"]
    
    # Chinese if only has CJK characters
    if has_chinese:
        return TTS_VOICES["zh"]
    
    # Spanish detection (common Spanish patterns)
    spanish_indicators = ['ñ', '¿', '¡', 'á', 'é', 'í', 'ó', 'ú', 'ü']
    spanish_words = ['hola', 'qué', 'cómo', 'por', 'para', 'está', 'esto', 'eso', 'muy', 'bien', 'niño', 'niña']
    text_lower = text.lower()
    
    if any(char in text for char in spanish_indicators) or any(word in text_lower for word in spanish_words):
        return TTS_VOICES["es"]
    
    # Default to English
    return TTS_VOICES["en"]


# Language code mapping for Google Speech Recognition
STT_LANGUAGES = {
    "en": "en-US",
    "zh": "zh-CN",
    "es": "es-MX",
    "ja": "ja-JP",
}


# DEPRECATED (yzbot Phase 1): The live Google STT round-trip is superseded by the
# Qwen-Omni Realtime path (/ws/realtime), which handles speech-to-text inline.
# The implementation is kept for reference but the route is no longer registered.
# @router.post("/voice/transcribe")
async def transcribe_audio(audio: UploadFile = File(...), language: Optional[str] = None):
    """
    [DEPRECATED — replaced by Qwen-Omni Realtime /ws/realtime]
    Transcribe audio file to text.

    Accepts WAV or WebM audio files.
    Pass language param (en/zh/es/ja) for better recognition accuracy.
    """
    import speech_recognition as sr

    stt_lang = STT_LANGUAGES.get(language, "en-US") if language else "en-US"
    
    # Determine file type from content type or filename
    content_type = audio.content_type or ""
    filename = audio.filename or ""
    
    is_webm = "webm" in content_type or "webm" in filename
    is_mp4 = "mp4" in content_type or "mp4" in filename
    
    # Save uploaded file temporarily
    suffix = ".webm" if is_webm else (".mp4" if is_mp4 else ".wav")
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    wav_path = tmp_path
    converted = False

    try:
        # Convert WebM/MP4 to WAV if needed (using ffmpeg if available)
        if is_webm or is_mp4:
            wav_path = tmp_path.replace(suffix, ".wav")
            try:
                result = subprocess.run(
                    ["ffmpeg", "-y", "-i", tmp_path, "-ar", "16000", "-ac", "1", wav_path],
                    capture_output=True,
                    timeout=30
                )
                if result.returncode == 0:
                    converted = True
                else:
                    print(f"[Transcribe] FFmpeg conversion failed: {result.stderr.decode()}")
                    wav_path = tmp_path
            except FileNotFoundError:
                print("[Transcribe] FFmpeg not found, trying direct read")
                wav_path = tmp_path
            except Exception as e:
                print(f"[Transcribe] Conversion error: {e}")
                wav_path = tmp_path

        recognizer = sr.Recognizer()

        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data, language=stt_lang)
            print(f"[Transcribe] Language: {stt_lang} | Text: {text}")
            return {"text": text, "success": True}

    except sr.UnknownValueError:
        return {"text": "", "success": False, "error": "Could not understand audio"}
    except sr.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Speech service error: {e}")
    except Exception as e:
        print(f"[Transcribe] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Cleanup
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
        if converted and wav_path != tmp_path:
            try:
                os.unlink(wav_path)
            except Exception:
                pass


@router.post("/voice/verify")
async def verify_voice(audio: UploadFile = File(...)):
    """
    Verify if the voice matches the registered owner.
    """
    voice_gatekeeper = get_voice_gatekeeper()
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        is_owner = voice_gatekeeper.verify_user(tmp_path) if voice_gatekeeper else True
        return {"verified": is_owner}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


# DEPRECATED (yzbot Phase 1): The live Edge TTS round-trip is superseded by the
# Qwen-Omni Realtime path (/ws/realtime), which streams synthesized voice (PCM16
# 24kHz) directly. The implementation is kept for reference but not registered.
# @router.post("/tts")
async def text_to_speech(text: str, lang: Optional[str] = None):
    """
    [DEPRECATED — replaced by Qwen-Omni Realtime /ws/realtime]
    Convert text to speech audio with auto language detection.

    Supported languages: en (English), zh (Chinese), es (Spanish), ja (Japanese)
    Returns MP3 audio stream.
    """
    import edge_tts
    
    # Use specified language or auto-detect from text
    if lang and lang in TTS_VOICES:
        voice = TTS_VOICES[lang]
    else:
        voice = detect_language(text)
    
    print(f"[TTS] Voice: {voice} | Text: {text[:50]}...")
    
    async def generate_audio():
        communicate = edge_tts.Communicate(text, voice)
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]
    
    return StreamingResponse(
        generate_audio(),
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline; filename=speech.mp3"
        }
    )
