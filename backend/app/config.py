import os


class Settings:
    """Simple env config, keep it stdlib-only for portability"""

    def __init__(self) -> None:
        self.env: str = os.getenv("NODE_ENV", "development")
        self.ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")

        self.ollama_model: str = "gemma3:27b" if self.env == "production" else "llama3.2:1b"

        self.postgres_user: str = os.getenv("POSTGRES_USER", "postgres")
        self.postgres_password: str = os.getenv("POSTGRES_PASSWORD", "postgres")
        self.postgres_db: str = os.getenv("POSTGRES_DB", "postgres")
        self.postgres_host: str = os.getenv("POSTGRES_HOST", "localhost")


settings = Settings()
