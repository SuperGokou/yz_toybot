"""Tests for the VV Montessori persona instruction builder (Task 2)."""

from app.prompts.vv_persona import build_instructions


def test_build_instructions_includes_persona_and_context():
    txt = build_instructions(child_name="小明", rag_snippets=["蒙特梭利:三段式教学"])
    assert "VV" in txt
    assert "小明" in txt
    assert "三段式教学" in txt
    assert "看到" in txt  # 强调它能看摄像头画面


def test_build_instructions_defaults_are_safe():
    txt = build_instructions()
    assert "VV" in txt
    assert "看到" in txt
    # No child name / no snippets must not crash or leak placeholders
    assert "None" not in txt
    assert "{" not in txt


def test_build_instructions_handles_empty_snippets_list():
    txt = build_instructions(child_name="", rag_snippets=[])
    assert "VV" in txt
