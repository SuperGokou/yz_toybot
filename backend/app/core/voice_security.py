"""
Voice Security / Speaker Verification for KidBot

Handles voice registration and verification using speaker embeddings.
"""

from pathlib import Path
from typing import Optional

from ..config import DATA_DIR


class VoiceGatekeeper:
    """Handles voice verification for KidBot."""

    def __init__(self, config: dict):
        """Initialize the Voice Gatekeeper."""
        self.config = config
        
        # Get paths from config or use defaults
        paths = config.get("paths", {})
        voice_config = config.get("voice", {})
        
        self.voice_prints_path = Path(paths.get("voice_prints", str(DATA_DIR / "voice_prints")))
        self.voice_prints_path.mkdir(parents=True, exist_ok=True)
        
        self.threshold = voice_config.get("verification_threshold", 0.75)
        self.enabled = voice_config.get("enabled", True)
        
        # Lazy load voice verification model
        self._encoder = None
        self._owner_embedding = None

    def _load_encoder(self):
        """Lazy load the voice encoder."""
        if self._encoder is None:
            try:
                from resemblyzer import VoiceEncoder
                self._encoder = VoiceEncoder()
                print("[Voice] Loaded voice encoder")
            except ImportError:
                print("[Voice] resemblyzer not installed, voice verification disabled")
                self.enabled = False

    def is_ready(self) -> bool:
        """Check if voice verification is set up."""
        if not self.enabled:
            return True  # Bypass if disabled
        
        owner_file = self.voice_prints_path / "owner_embedding.npy"
        return owner_file.exists()

    def register_voice(self, audio_path: str) -> bool:
        """Register a voice print for the owner."""
        if not self.enabled:
            return True
            
        self._load_encoder()
        if self._encoder is None:
            return False
            
        try:
            import numpy as np
            from resemblyzer import preprocess_wav
            
            wav = preprocess_wav(audio_path)
            embedding = self._encoder.embed_utterance(wav)
            
            # Save embedding
            np.save(self.voice_prints_path / "owner_embedding.npy", embedding)
            self._owner_embedding = embedding
            
            print("[Voice] Registered owner voice print")
            return True
            
        except Exception as e:
            print(f"[Voice] Registration error: {e}")
            return False

    def verify_user(self, audio_path: str) -> bool:
        """Verify if the voice matches the registered owner."""
        if not self.enabled:
            return True  # Bypass if disabled
            
        if not self.is_ready():
            return True  # Allow if not set up
            
        self._load_encoder()
        if self._encoder is None:
            return True
            
        try:
            import numpy as np
            from resemblyzer import preprocess_wav
            
            # Load owner embedding if not cached
            if self._owner_embedding is None:
                owner_file = self.voice_prints_path / "owner_embedding.npy"
                self._owner_embedding = np.load(owner_file)
            
            # Get embedding for input audio
            wav = preprocess_wav(audio_path)
            test_embedding = self._encoder.embed_utterance(wav)
            
            # Calculate cosine similarity
            similarity = np.dot(self._owner_embedding, test_embedding)
            
            print(f"[Voice] Similarity: {similarity:.3f} (threshold: {self.threshold})")
            return similarity >= self.threshold
            
        except Exception as e:
            print(f"[Voice] Verification error: {e}")
            return True  # Allow on error
