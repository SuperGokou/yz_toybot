"""Pytest configuration for the yzbot backend test suite.

Ensures the ``app`` package (located in the ``backend`` directory) is importable
regardless of the directory pytest is invoked from.
"""

import sys
from pathlib import Path

# backend/ is the parent of this tests/ directory; adding it to sys.path makes
# ``import app`` resolve to backend/app.
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
