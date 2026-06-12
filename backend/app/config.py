"""
Configuration management for KidBot backend.
"""

import os
from pathlib import Path
from typing import Optional

import yaml
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Base paths
BASE_DIR = Path(__file__).parent.parent.parent
CONFIG_DIR = BASE_DIR / "config"
DATA_DIR = BASE_DIR / "data"


def load_config(config_path: Optional[Path] = None) -> dict:
    """
    Load configuration from YAML file.
    
    Priority:
    1. Provided config_path
    2. config/config.yaml
    3. config/config.yaml.example (fallback)
    """
    if config_path is None:
        config_path = CONFIG_DIR / "config.yaml"
        
        if not config_path.exists():
            config_path = CONFIG_DIR / "config.yaml.example"
    
    if not config_path.exists():
        print(f"[Config] Warning: No config file found at {config_path}, using defaults")
        return apply_env_overrides(get_default_config())
    
    print(f"[Config] Found config at: {config_path}")
    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    # Resolve relative paths to absolute
    if "paths" in config:
        for key, value in config["paths"].items():
            p = Path(value)
            if not p.is_absolute():
                config["paths"][key] = str(BASE_DIR / value)
    
    # Override with environment variables
    config = apply_env_overrides(config)
    
    return config


def apply_env_overrides(config: dict) -> dict:
    """Apply environment variable overrides to config."""
    
    # API Keys
    if os.getenv("DEEPSEEK_API_KEY"):
        if "llm" not in config:
            config["llm"] = {}
        config["llm"]["api_key"] = os.getenv("DEEPSEEK_API_KEY")
    
    if os.getenv("OPENAI_API_KEY"):
        if "llm" not in config:
            config["llm"] = {}
        config["llm"]["api_key"] = os.getenv("OPENAI_API_KEY")
    
    # Robot settings
    if os.getenv("ROBOT_NAME"):
        if "robot" not in config:
            config["robot"] = {}
        config["robot"]["name"] = os.getenv("ROBOT_NAME")
    
    return config


def get_default_config() -> dict:
    """Return default configuration for production deployment."""
    return {
        "robot": {
            "name": os.getenv("ROBOT_NAME", "VV"),
            "personality": "A friendly, curious, and encouraging companion who loves to learn and play with children. Speaks in simple, cheerful sentences.",
            "voice": "en-US-AnaNeural"
        },
        "api": {
            "deepseek": {
                "base_url": os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
                "model": os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
            }
        },
        "llm": {
            "model": os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
            "temperature": 0.7,
            "max_tokens": 500,
            "api_key": os.getenv("DEEPSEEK_API_KEY")
        },
        "rag": {
            "collection_name": "kidbot_memory",
            "embedding_model": "all-MiniLM-L6-v2"
        },
        "paths": {
            "raw_docs": str(DATA_DIR / "raw_docs"),
            "vector_store": str(DATA_DIR / "vector_store"),
            "voice_prints": str(DATA_DIR / "voice_prints")
        },
        "voice": {
            "enabled": False,  # Disabled by default in production
            "verification_threshold": 0.75
        }
    }


# Singleton config instance
_config: Optional[dict] = None


def get_config() -> dict:
    """Get or load configuration (singleton pattern)."""
    global _config
    if _config is None:
        _config = load_config()
    return _config
