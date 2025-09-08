import os
from typing import Optional

class Settings:
    """Simple env config, keep it stdlib-only for portability"""
    def __init__(self) -> None:
        self.env: str = os.getenv("ENV", "dev")
        self.default_provider: str = os.getenv("LLM_PROVIDER", "ollama")
        self.model: str = os.getenv("LLM_MODEL", "llama3.2:1b")

        # Ollama
        self.ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

        # Server
        self.debug: bool = os.getenv("DEBUG", "true").lower() == "true"

settings = Settings()