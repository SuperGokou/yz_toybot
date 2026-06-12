"""Tests for Qwen-Omni Realtime / vision configuration (Task 1).

The project uses a dict-based config (``get_default_config`` / ``apply_env_overrides``),
not a pydantic Settings class. These tests assert the ``qwen_omni`` section exists
with the expected defaults and that ``DASHSCOPE_API_KEY`` overrides the api key.
"""

import importlib

from app import config as config_module


def test_qwen_omni_section_defaults():
    cfg = config_module.get_default_config()
    assert "qwen_omni" in cfg
    qo = cfg["qwen_omni"]
    assert qo["model"] == "qwen3.5-omni-plus-realtime"
    assert qo["voice"] == "Cherry"
    assert qo["ws_url"] == "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"
    assert qo["input_sample_rate"] == 16000
    assert qo["output_sample_rate"] == 24000
    assert qo["vision_fps"] == 1.5
    # api_key default present (empty / None when env not set)
    assert "api_key" in qo


def test_dashscope_api_key_env_override(monkeypatch):
    monkeypatch.setenv("DASHSCOPE_API_KEY", "sk-test-omni")
    cfg = config_module.apply_env_overrides(config_module.get_default_config())
    assert cfg["qwen_omni"]["api_key"] == "sk-test-omni"


def test_env_override_creates_section_when_missing(monkeypatch):
    monkeypatch.setenv("DASHSCOPE_API_KEY", "sk-late")
    cfg = config_module.apply_env_overrides({})
    assert cfg["qwen_omni"]["api_key"] == "sk-late"
