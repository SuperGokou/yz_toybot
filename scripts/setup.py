#!/usr/bin/env python3
"""
Setup script for KidBot.

Installs dependencies and sets up the project.
"""

import os
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent


def run_command(cmd, cwd=None):
    """Run a command and print output."""
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout)
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        return False
    return True


def main():
    """Run setup steps."""
    print("[setup] Setting up KidBot...\n")
    
    # 1. Install Python dependencies
    print("[setup] Installing Python dependencies...")
    if not run_command([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], cwd=PROJECT_ROOT):
        print("Failed to install Python dependencies")
        return
    
    # 2. Install frontend dependencies
    print("\n[setup] Installing frontend dependencies...")
    frontend_dir = PROJECT_ROOT / "frontend"
    if not run_command(["npm", "install"], cwd=frontend_dir):
        print("Failed to install frontend dependencies")
        return
    
    # 3. Create data directories
    print("\n[setup] Creating data directories...")
    data_dirs = [
        PROJECT_ROOT / "data" / "raw_docs",
        PROJECT_ROOT / "data" / "vector_store",
        PROJECT_ROOT / "data" / "voice_prints",
    ]
    for dir_path in data_dirs:
        dir_path.mkdir(parents=True, exist_ok=True)
        gitkeep = dir_path / ".gitkeep"
        gitkeep.touch()
    
    # 4. Create .env file if not exists
    env_file = PROJECT_ROOT / ".env"
    env_example = PROJECT_ROOT / ".env.example"
    
    if not env_file.exists() and env_example.exists():
        print("\n[setup] Creating .env file from template...")
        import shutil
        shutil.copy(env_example, env_file)
        print("   Created .env - please add your API keys!")
    
    # 5. Create config if not exists
    config_file = PROJECT_ROOT / "config" / "config.yaml"
    config_example = PROJECT_ROOT / "config" / "config.yaml.example"
    
    if not config_file.exists() and config_example.exists():
        print("\n[setup] Creating config.yaml from template...")
        import shutil
        shutil.copy(config_example, config_file)
    
    print("\n[setup] Setup complete!")
    print("\nNext steps:")
    print("1. Add your DEEPSEEK_API_KEY to .env")
    print("2. Run: python scripts/dev.py")
    print("3. Open: http://localhost:5173")


if __name__ == "__main__":
    main()
