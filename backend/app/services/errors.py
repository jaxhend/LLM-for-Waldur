from fastapi import HTTPException
from rich import status


class LLMError(HTTPException):
    def __init__(self, message: str):
        super().__init__(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail= f"LLM provider error: {message}")