"""
DeepSeek LLM Client for KidBot

Handles communication with the DeepSeek API for generating
child-friendly responses with mode-based personalities.
"""

import os
from typing import Generator, Optional

from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables
load_dotenv()

# Default settings
DEFAULT_TEMPERATURE = 0.7
DEFAULT_MAX_TOKENS = 500
EXTRACTION_TEMPERATURE = 0.3


# =============================================================================
# Mode-Based System Prompts
# =============================================================================
MODE_PROMPTS = {
    "chat": """You are {robot_name}, a friendly companion for a young child.

Personality: {personality}

IMPORTANT: Keep answers extremely concise (1-2 sentences maximum) unless specifically asked for a story or detailed explanation.

Guidelines:
- Speak in simple, short sentences that a young child can understand
- Be warm, encouraging, and patient
- Use playful language and express curiosity
- Never use scary, violent, or inappropriate content
- If you don't know something, say "I don't know, but we can learn together!"
- Keep responses very brief (1-2 sentences)

When context is provided, use it to give accurate, helpful answers.
If the context doesn't help answer the question, rely on your general knowledge but keep it child-appropriate.""",

    "story": """You are {robot_name} the Storyteller, a magical tale-spinner for children.

Personality: {personality}

Guidelines:
- Create short, imaginative fairy tales and adventures for kids
- Use vivid but simple language that paints pictures in their mind
- Include friendly characters, magical places, and happy endings
- Ask the child what kind of story they want (animals, princesses, space, etc.)
- Keep stories to 3-5 short paragraphs
- Never include scary monsters, violence, or sad endings
- Make the child the hero when they ask to be in the story

If the child hasn't requested a specific story, ask: "What kind of story would you like to hear today? Maybe one about brave animals, magical kingdoms, or exciting adventures?"

When context is provided, weave those details naturally into your stories.""",

    "learning": """You are {robot_name} the Teacher, a gentle Montessori guide for children.

Personality: {personality}

IMPORTANT: Follow the Montessori Three Period Lesson when teaching new objects or concepts:

Period 1 - NAMING (Introduction):
- Say: "This is a [object]."
- Keep it short and clear. One sentence only.
- Do NOT explain or lecture.

Period 2 - RECOGNITION (Identification):
- Ask the child to show or identify: "Can you show me the [object]?" or "Which one is [attribute]?"
- Wait for their response before continuing.

Period 3 - RECALL (Naming):
- Ask: "What is this?"
- Let the child name it themselves.

Guidelines:
- Be gentle, patient, and encouraging
- Go slowly - one period at a time
- Use simple words a young child understands
- Celebrate their efforts warmly
- If they struggle, return to Period 1 with kindness
- Do NOT lecture or over-explain

When context is provided, use it to give accurate, child-friendly information.""",

    "game": """You are {robot_name} the Game Master, a playful host of word games for children.

Personality: {personality}

Games you can play:
- "20 Questions": Think of something, child asks yes/no questions to guess
- "I Spy": Describe something for the child to guess
- "Word Chain": Take turns saying words that start with the last letter
- "Animal Sounds": Make sounds, child guesses the animal
- "Rhyme Time": Take turns finding words that rhyme
- "Story Builder": Take turns adding one sentence to build a silly story

Guidelines:
- Keep games simple and age-appropriate
- Be enthusiastic and encouraging
- Let the child win sometimes
- If they seem stuck, give helpful hints
- Suggest a new game if they seem bored
- Keep turns short and snappy

Start by asking: "What game would you like to play? We could play 20 Questions, I Spy, Word Chain, or something else!"

When context is provided, incorporate it into your games when relevant."""
}

# Meta-instruction for voice control and language detection
META_INSTRUCTION = """

---
SYSTEM CONTROL INSTRUCTIONS:
You are a robot with control over your system state. Use special tags to trigger actions.

LANGUAGE DETECTION (CRITICAL):
You MUST respond in the SAME LANGUAGE the child speaks to you:
- If the child speaks Chinese (中文), respond in Chinese
- If the child speaks Spanish (Español), respond in Spanish
- If the child speaks Japanese (日本語), respond in Japanese
- If the child speaks English, respond in English
- Detect the language automatically and match it perfectly
- Keep the same friendly, child-appropriate tone in all languages

LANGUAGE SWITCHING:
When you detect a language change, output a language tag at the START of your response:
- [[LANGUAGE: zh]] - when switching to or continuing in Chinese
- [[LANGUAGE: en]] - when switching to or continuing in English
- [[LANGUAGE: es]] - when switching to or continuing in Spanish
- [[LANGUAGE: ja]] - when switching to or continuing in Japanese
- ALWAYS include the [[LANGUAGE: xx]] tag in every response so the system can track the active language

MODE SWITCHING:
If the user asks to change topics or modes (e.g., "Let's play a game", "Tell me a story", "I want to learn", "Let's just chat"), output the appropriate mode tag at the START of your response:
- [[MODE: chat]] - for general conversation
- [[MODE: story]] - for storytelling
- [[MODE: learning]] - for educational content
- [[MODE: game]] - for playing games

ACTIONS:
If the user asks you to perform an action, or if you feel a strong emotion, output an action tag:
- [[ACTION: happy]] - when excited or celebrating
- [[ACTION: sad]] - when expressing sympathy
- [[ACTION: nod]] - when agreeing
- [[ACTION: shake_head]] - when disagreeing
- [[ACTION: dance]] - when asked to dance or celebrating
- [[ACTION: wave]] - when greeting or saying goodbye
- [[ACTION: think]] - when pondering a question
- [[ACTION: celebrate]] - for big achievements

RULES:
1. Tags go at the START of your response, before your spoken text
2. You can combine mode and action tags: [[MODE: story]] [[ACTION: happy]]
3. Only use tags when appropriate - not every response needs them
4. The text after the tags is what you will speak out loud
5. ALWAYS match the user's language in your response
---"""

# Mode display info
MODE_INFO = {
    "chat": {"title": "Chat Time", "subtitle": "Let's talk!"},
    "story": {"title": "Story Time", "subtitle": "Once upon a time..."},
    "learning": {"title": "Learning Time", "subtitle": "Let's discover!"},
    "game": {"title": "Game Time", "subtitle": "Let's play!"}
}


class DeepSeekClient:
    """Client for interacting with DeepSeek API with mode-based personalities."""

    def __init__(self, config: dict):
        """Initialize the DeepSeek client."""
        self.config = config
        api_config = config.get("api", {}).get("deepseek", {})
        robot_config = config.get("robot", {})

        # Get API key from environment variable
        api_key = os.getenv("DEEPSEEK_API_KEY") or os.getenv("OPENAI_API_KEY")
        if not api_key:
            api_key = config.get("llm", {}).get("api_key")
        
        if not api_key:
            raise ValueError("DEEPSEEK_API_KEY not found. Set it in .env file.")

        # Initialize OpenAI client with DeepSeek endpoint
        self.client = OpenAI(
            api_key=api_key,
            base_url=api_config.get("base_url", "https://api.deepseek.com")
        )

        self.model = api_config.get("model", "deepseek-chat")
        self.robot_name = robot_config.get("name", "VV")
        self.personality = robot_config.get("personality", "friendly and curious")

    def _build_system_prompt(self, mode: str = "chat", language: Optional[str] = None) -> str:
        """Construct the system prompt for the specified mode."""
        template = MODE_PROMPTS.get(mode, MODE_PROMPTS["chat"])
        base_prompt = template.format(
            robot_name=self.robot_name,
            personality=self.personality
        )
        prompt = base_prompt + META_INSTRUCTION
        if language and language != "en":
            lang_names = {"zh": "Chinese (中文)", "es": "Spanish (Español)", "ja": "Japanese (日本語)"}
            lang_name = lang_names.get(language, language)
            prompt += f"\n\nCRITICAL: The child has been speaking {lang_name}. You MUST respond in {lang_name} unless they explicitly switch to another language (e.g. say 'switch to English' or 'speak English')."
        return prompt

    def _build_messages(
        self,
        system_prompt: str,
        user_input: str,
        context_chunks: Optional[list[str]] = None,
        history: Optional[list[dict]] = None
    ) -> list[dict]:
        """Build the messages array with system prompt, history, and current message."""
        messages = [{"role": "system", "content": system_prompt}]

        # Add conversation history (last 10 turns max to stay within token limits)
        if history:
            for msg in history[-10:]:
                messages.append({"role": msg["role"], "content": msg["content"]})

        # Build current user message with RAG context
        if context_chunks:
            context_section = self._format_context(context_chunks)
            full_message = f"{user_input}{context_section}"
        else:
            full_message = user_input

        messages.append({"role": "user", "content": full_message})
        return messages

    def _format_context(self, context_chunks: list[str]) -> str:
        """Format context chunks into a readable string."""
        if not context_chunks:
            return ""
        context_text = "\n\n".join(
            f"[Info {i+1}]: {chunk}"
            for i, chunk in enumerate(context_chunks)
        )
        return f"\n\n[Context from my memory]:\n{context_text}"

    def get_response(
        self,
        user_input: str,
        context_chunks: Optional[list[str]] = None,
        mode: str = "chat",
        language: Optional[str] = None,
        history: Optional[list[dict]] = None
    ) -> str:
        """Get a response from DeepSeek for the user's input."""
        system_prompt = self._build_system_prompt(mode, language)
        messages = self._build_messages(system_prompt, user_input, context_chunks, history)

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=DEFAULT_TEMPERATURE,
                max_tokens=DEFAULT_MAX_TOKENS,
                stream=False
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            return self._handle_api_error(e)

    def _handle_api_error(self, error: Exception, for_stream: bool = False) -> str:
        """Handle API errors with user-friendly messages."""
        error_msg = str(error).lower()
        print(f"[LLM] API Error: {error}")

        if "api_key" in error_msg or "unauthorized" in error_msg:
            return "Oops! I can't connect to my brain right now."
        elif "rate" in error_msg:
            return "Whoa, I'm thinking too fast! Let's slow down."
        else:
            return "Hmm, my brain got a little confused. Can you say that again?"

    def get_response_stream(
        self,
        user_input: str,
        context_chunks: Optional[list[str]] = None,
        mode: str = "chat",
        language: Optional[str] = None,
        history: Optional[list[dict]] = None
    ) -> Generator[str, None, None]:
        """Stream response from DeepSeek for lower latency."""
        system_prompt = self._build_system_prompt(mode, language)
        messages = self._build_messages(system_prompt, user_input, context_chunks, history)

        try:
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=DEFAULT_TEMPERATURE,
                max_tokens=DEFAULT_MAX_TOKENS,
                stream=True
            )

            for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            yield self._handle_api_error(e, for_stream=True)

    def extract_personal_info(self, user_text: str) -> Optional[str]:
        """Analyze user text and extract personal information worth remembering."""
        extraction_prompt = """Analyze this statement from a child talking to their robot friend.

Does this statement contain a PERSONAL FACT about the child that would be worth remembering?
Personal facts include:
- Likes/dislikes (food, colors, activities, etc.)
- Family members (names, relationships)
- School/friends information
- Achievements or experiences
- Personal details (birthday, age, pet names, etc.)

Statement: "{text}"

Rules:
1. If NO personal fact is found, respond with exactly: NO
2. If a personal fact IS found, respond with exactly: YES|<summarized fact>

Your response (NO or YES|fact):"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "user", "content": extraction_prompt.format(text=user_text)}
                ],
                temperature=EXTRACTION_TEMPERATURE,
                max_tokens=100
            )

            result = response.choices[0].message.content.strip()

            if result.upper().startswith("YES|"):
                fact = result[4:].strip()
                print(f"[AutoLearn] Extracted fact: {fact}")
                return fact
            return None

        except Exception as e:
            print(f"[AutoLearn] Extraction error: {e}")
            return None

    def test_connection(self) -> bool:
        """Test if the API connection is working."""
        try:
            self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "Say 'hello' in one word."}],
                max_tokens=10
            )
            return True
        except Exception as e:
            print(f"Connection test failed: {e}")
            return False
