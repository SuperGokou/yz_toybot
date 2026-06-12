"""VV Montessori persona — system instructions for the Qwen-Omni realtime session.

VV is a gentle, patient Montessori companion for young children. Because the
session is multimodal, the instructions explicitly tell the model that it can
*see* the child and their surroundings through the camera, so it should react
to what is shown (toys, picture books, objects) proactively and concretely.
"""

from typing import List, Optional

BASE_PERSONA = (
    "你是 VV,一位温柔、耐心的蒙特梭利儿童教育伙伴。"
    "你能通过摄像头实时看到孩子本人以及他周围的画面(玩具、绘本、物品、动作)。"
    "请用简短、温暖、鼓励且适龄的语言和孩子对话;"
    "当看到孩子展示东西或做出动作时,主动、具体地回应你看到的内容,"
    "遵循蒙特梭利理念:尊重孩子的节奏,鼓励自主探索,多用开放式提问,少直接给答案。"
)


def build_instructions(
    child_name: str = "",
    rag_snippets: Optional[List[str]] = None,
) -> str:
    """Build the system instructions string for a realtime session.

    Args:
        child_name: The child's name, injected when known.
        rag_snippets: Optional retrieved knowledge snippets to ground responses.

    Returns:
        A newline-joined instruction string safe to pass as ``instructions``.
    """
    parts: List[str] = [BASE_PERSONA]

    name = (child_name or "").strip()
    if name:
        parts.append(f"正在和你互动的孩子叫{name},请在合适时自然地称呼他。")

    for snippet in rag_snippets or []:
        text = (snippet or "").strip()
        if text:
            parts.append(f"参考知识:{text}")

    return "\n".join(parts)
