#!/usr/bin/env python3
"""
Development server runner for KidBot.

Starts both the FastAPI backend and React frontend concurrently.
"""

import os
import subprocess
import sys
import signal
from pathlib import Path

# Get project root
PROJECT_ROOT = Path(__file__).parent.parent

def main():
    """Run both backend and frontend servers."""
    processes = []
    
    try:
        # Start backend
        print("[dev] Starting FastAPI backend on http://localhost:8000")
        backend_cmd = [
            sys.executable, "-m", "uvicorn",
            "backend.app.main:app",
            "--reload",
            "--host", "0.0.0.0",
            "--port", "8000"
        ]
        backend_proc = subprocess.Popen(
            backend_cmd,
            cwd=PROJECT_ROOT,
            env={**os.environ, "PYTHONPATH": str(PROJECT_ROOT)}
        )
        processes.append(backend_proc)
        
        # Start frontend
        print("[dev] Starting React frontend on http://localhost:5173")
        frontend_dir = PROJECT_ROOT / "frontend"
        frontend_cmd = ["npm", "run", "dev"]
        frontend_proc = subprocess.Popen(
            frontend_cmd,
            cwd=frontend_dir,
            shell=True
        )
        processes.append(frontend_proc)
        
        print("\n[dev] KidBot is running!")
        print("   Backend:  http://localhost:8000")
        print("   Frontend: http://localhost:5173")
        print("   API Docs: http://localhost:8000/docs")
        print("\nPress Ctrl+C to stop...\n")
        
        # Wait for processes
        for proc in processes:
            proc.wait()
            
    except KeyboardInterrupt:
        print("\n\n[dev] Stopping servers...")
        for proc in processes:
            proc.terminate()
        for proc in processes:
            proc.wait()
        print("[dev] Servers stopped.")


if __name__ == "__main__":
    main()
