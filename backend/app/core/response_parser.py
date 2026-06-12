"""
Response parser for extracting commands from LLM responses.
"""

import re
from typing import Tuple, Dict


def parse_response(response: str) -> Tuple[Dict[str, str], str]:
    """
    Parse LLM response for hidden command tags.
    
    Commands are embedded as XML-like tags:
    - <MODE:story> - Switch to story mode
    - <ACTION:play_sound> - Trigger an action
    
    Returns:
        Tuple of (commands dict, cleaned response text)
    """
    commands = {}
    clean_response = response
    
    # Extract MODE commands (both <MODE:x> and [[MODE: x]] styles)
    mode_match = re.search(r'<MODE:(\w+)>', response) or re.search(r'\[\[MODE:\s*(\w+)\]\]', response)
    if mode_match:
        commands['mode'] = mode_match.group(1)
        clean_response = re.sub(r'<MODE:\w+>', '', clean_response)
        clean_response = re.sub(r'\[\[MODE:\s*\w+\]\]', '', clean_response)

    # Extract ACTION commands (both <ACTION:x> and [[ACTION: x]] styles)
    action_match = re.search(r'<ACTION:(\w+)>', response) or re.search(r'\[\[ACTION:\s*(\w+)\]\]', response)
    if action_match:
        commands['action'] = action_match.group(1)
        clean_response = re.sub(r'<ACTION:\w+>', '', clean_response)
        clean_response = re.sub(r'\[\[ACTION:\s*\w+\]\]', '', clean_response)

    # Extract LANGUAGE commands (both <LANGUAGE:x> and [[LANGUAGE: x]] styles)
    lang_match = re.search(r'\[\[LANGUAGE:\s*(\w+)\]\]', response) or re.search(r'<LANGUAGE:(\w+)>', response)
    if lang_match:
        commands['language'] = lang_match.group(1).lower()
        clean_response = re.sub(r'\[\[LANGUAGE:\s*\w+\]\]', '', clean_response)
        clean_response = re.sub(r'<LANGUAGE:\w+>', '', clean_response)
    
    # Clean up whitespace
    clean_response = clean_response.strip()
    
    return commands, clean_response
